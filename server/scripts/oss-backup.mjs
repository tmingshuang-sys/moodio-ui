// 备份文件上 OSS / 看看有哪些 / 拿回来。凭证走 store.mjs 的配置（线上是实例角色），所以在服务器上跑：
//   node --env-file=.env scripts/oss-backup.mjs upload /var/backups/wow/wow-xxx.tar.gz     （backup.sh 每天自动调）
//   npm run oss:backups                                                                    （列出 OSS 里的备份）
//   node --env-file=.env scripts/oss-backup.mjs download backups/wow-xxx.tar.gz /tmp/x.tar.gz
// 备份里有密钥，所以上传时要求 OSS 服务端加密（x-oss-server-side-encryption），bucket 本身也是私有的
import fs from 'fs/promises';
import path from 'path';
import { ossBackend } from '../src/store.mjs';
import { closeDb } from '../src/db.mjs';

const [cmd, a, b] = process.argv.slice(2);
try {
  const oss = await ossBackend();
  if (cmd === 'upload') {
    if (!a) throw new Error('缺少文件路径');
    const key = b || 'backups/' + path.basename(a);
    await oss.put(key, await fs.readFile(a), 'application/gzip', { 'x-oss-server-side-encryption': 'AES256' });
    const st = await oss.stat(key);
    if (!st) throw new Error('上传后在 OSS 里查不到');
    console.log(key);                                   // 只打印 key，backup.sh 拿它写状态文件
  } else if (cmd === 'list') {
    const { objects } = await oss.list('backups/');
    for (const o of objects.sort((x, y) => (x.lastModified < y.lastModified ? -1 : 1))) console.log(o.lastModified, String(o.size).padStart(12), o.key);
    console.log(`${objects.length} 份`);
  } else if (cmd === 'download') {
    if (!a) throw new Error('缺少 key');
    const buf = await oss.get(a);
    if (!buf) throw new Error('OSS 里没有 ' + a);
    const out = b || path.basename(a);
    await fs.writeFile(out, buf, { mode: 0o600 });
    console.log('已下载', out, buf.length, '字节');
  } else {
    console.error('用法：oss-backup.mjs upload <文件> [key] | list | download <key> [文件]');
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
