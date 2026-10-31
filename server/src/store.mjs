// 对象存储：媒体二进制放这里，库里只留 object_key。本机开发写磁盘；线上配了 OSS 就走 OSS。
// OSS 在网页的「服务器设置」里配（OSS_BUCKET / OSS_REGION / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET，
// 可选 OSS_ENDPOINT），也可以写在 .env 里；和模型 key 一样库里的优先。所以后端是**每次调用时**按当前配置选的，
// 填完即生效、不用重启，清掉 OSS_BUCKET 又回到磁盘。
//
// 两条原则：
//   ① 配了 OSS 就只往 OSS 写。写不进去就报错，绝不悄悄退回本机磁盘——那样文件会散在两处，重装机器就丢。
//   ② 读的时候 OSS 里没有就看一眼本机磁盘。这是给「从磁盘切到 OSS」的过渡期用的：老文件还躺在磁盘上，
//      跑一次 scripts/migrate-blobs.mjs 搬完之后这条路自然就没流量了。
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createOss } from './oss.mjs';
import { allSettings } from './settings.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = process.env.WOW_BLOB_DIR || path.resolve(HERE, '..', 'blobs');

const local = {
  kind: 'local',
  async put(key, buf) {
    const p = path.join(LOCAL_DIR, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, buf);
    return key;
  },
  async get(key) {
    try { return await fs.readFile(path.join(LOCAL_DIR, key)); } catch { return null; }
  },
  async del(key) { await fs.rm(path.join(LOCAL_DIR, key), { force: true }); },
  async stat(key) {
    try { const s = await fs.stat(path.join(LOCAL_DIR, key)); return { size: s.size }; } catch { return null; }
  },
};

// 当前生效的 OSS 配置：库里的优先，其次 .env；没配 OSS_BUCKET 就是 null（= 用磁盘）
export async function ossConfig() {
  const s = await allSettings().catch(() => ({}));
  const v = k => s[k] || process.env[k] || '';
  const bucket = v('OSS_BUCKET').trim();
  if (!bucket) return null;
  return { bucket, region: v('OSS_REGION').trim() || 'oss-cn-hongkong', endpoint: v('OSS_ENDPOINT').trim(), accessKeyId: v('OSS_ACCESS_KEY_ID').trim(), accessKeySecret: v('OSS_ACCESS_KEY_SECRET').trim() };
}

let ossClient = null, ossKey = '';
async function backend() {
  const c = await ossConfig();
  if (!c) return local;
  if (!c.accessKeyId || !c.accessKeySecret) throw new Error('配了 OSS_BUCKET 但没有 AccessKey：在「服务器设置」里把 OSS 的 AccessKey ID 与 Secret 填上，或者清掉 OSS_BUCKET 回到本机磁盘');
  const k = JSON.stringify(c);
  if (k !== ossKey) { ossClient = createOss(c); ossKey = k; }
  return ossClient;
}
// 迁移脚本用：拿到 OSS 客户端本身，没配就明确报错
export async function ossBackend() {
  const b = await backend();
  if (b === local) throw new Error('没有配置 OSS（OSS_BUCKET 为空）');
  return b;
}

export const blobs = {
  async put(key, buf, mime) { return (await backend()).put(key, buf, mime); },
  async get(key) {
    const b = await backend();
    if (b === local) return local.get(key);
    let got = null, failure = null;
    try { got = await b.get(key); } catch (e) { failure = e; }
    if (got) return got;
    const copy = await local.get(key);                            // 过渡期：OSS 里没有（或读不到）就看本机磁盘
    if (copy) { if (failure) console.warn(`OSS 读 ${key} 失败（${failure.message}），用了本机磁盘上的副本`); return copy; }
    if (failure) throw failure;
    return null;
  },
  async del(key) {
    const b = await backend();
    await b.del(key);
    if (b !== local) await local.del(key);
  },
  async stat(key) {
    const b = await backend();
    return (await b.stat(key)) || (b === local ? null : local.stat(key));
  },
};
export const blobDir = LOCAL_DIR;
export const local_ = local;

// 给 /health 与启动日志看的：现在用的是哪种存储、通不通。
// OSS 探一次要走一趟网络，结果缓存 60 秒；配置一变（key 不同）立刻重探
let ping = { key: '', at: 0, result: null };
export async function blobsHealth() {
  let c;
  try { c = await ossConfig(); } catch (e) { return { kind: 'oss', ok: false, error: String(e.message) }; }
  if (!c) return { kind: 'local', ok: fss.existsSync(path.dirname(LOCAL_DIR)), dir: LOCAL_DIR };
  const k = JSON.stringify(c);
  if (ping.key === k && Date.now() - ping.at < 60_000) return ping.result;
  let result;
  try {
    const r = await (await backend()).ping();
    result = { kind: 'oss', ok: r.ok, error: r.error, bucket: c.bucket, region: c.region };
  } catch (e) {
    result = { kind: 'oss', ok: false, error: String(e.message), bucket: c.bucket, region: c.region };
  }
  ping = { key: k, at: Date.now(), result };
  return result;
}
export const mediaKey = (userId, mediaId, ext = '') => `${userId}/${mediaId}${ext}`;
