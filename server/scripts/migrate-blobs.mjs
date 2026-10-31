// 把本机磁盘上的媒体文件搬进 OSS。切到 OSS 之后老文件还躺在 server/blobs/ 里，store.mjs 读的时候会兜底去磁盘找，
// 所以不搬也能用；搬是为了把磁盘腾出来、以后重装机器不丢文件。
//   cd /opt/wow/server && npm run blobs:migrate          # 搬完校验大小一致后删掉本机那份
//   cd /opt/wow/server && npm run blobs:migrate -- --keep # 只上传，不删本机
// 可以反复跑：OSS 里已经有且大小一致的直接跳过。
import fs from 'fs/promises';
import path from 'path';
import { ossBackend, blobDir } from '../src/store.mjs';
import { closeDb } from '../src/db.mjs';

const keep = process.argv.includes('--keep');
const oss = await ossBackend();
const ping = await oss.ping();
if (!ping.ok) { console.error('OSS 连不上：' + ping.error); await closeDb(); process.exit(1); }

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.isFile()) yield p;
  }
}
let moved = 0, skipped = 0, bytes = 0;
for await (const file of walk(blobDir)) {
  const key = path.relative(blobDir, file).split(path.sep).join('/');
  const size = (await fs.stat(file)).size;
  const there = await oss.stat(key);
  if (!there || there.size !== size) {
    await oss.put(key, await fs.readFile(file));
    const check = await oss.stat(key);
    if (!check || check.size !== size) { console.error(`✗ ${key}：上传后大小不对（本机 ${size}，OSS ${check?.size}），本机那份保留`); continue; }
    moved++; bytes += size;
    console.log(`↑ ${key}  ${(size / 1048576).toFixed(1)} MB`);
  } else skipped++;
  if (!keep) await fs.rm(file, { force: true });
}
console.log(`完成：上传 ${moved} 个（${(bytes / 1048576).toFixed(1)} MB），OSS 里已有 ${skipped} 个${keep ? '，本机文件保留' : '，本机副本已删'}`);
await closeDb();
