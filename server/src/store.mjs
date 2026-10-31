// 对象存储：媒体二进制放这里，库里只留 object_key。
// 本机开发写磁盘；线上用阿里云 OSS。接口只有四个方法，换后端不影响调用方。
// 现在先把磁盘这条路写完，OSS 那条留好位置——等机器开出来、拿到 bucket 再接，不影响现在联调。
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    const p = path.join(LOCAL_DIR, key);
    try { return await fs.readFile(p); } catch { return null; }
  },
  async del(key) { await fs.rm(path.join(LOCAL_DIR, key), { force: true }); },
  async stat(key) {
    try { const s = await fs.stat(path.join(LOCAL_DIR, key)); return { size: s.size }; } catch { return null; }
  },
};

// 阿里云 OSS：等 bucket 开出来再接。故意不提前装 SDK——没配就明确报错，而不是悄悄退回本机磁盘，
// 不然线上写进了容器的临时盘，重启就没了，这种错最难查。
const oss = {
  kind: 'oss',
  async put() { throw new Error('OSS 还没接：配了 OSS_BUCKET 就必须把 src/store.mjs 的 oss 实现补上'); },
  async get() { throw new Error('OSS 还没接'); },
  async del() { throw new Error('OSS 还没接'); },
  async stat() { throw new Error('OSS 还没接'); },
};

export const blobs = process.env.OSS_BUCKET ? oss : local;
export const blobDir = LOCAL_DIR;
export const blobsReady = () => (blobs.kind === 'local' ? fss.existsSync(path.dirname(LOCAL_DIR)) : true);
export const mediaKey = (userId, mediaId, ext = '') => `${userId}/${mediaId}${ext}`;
