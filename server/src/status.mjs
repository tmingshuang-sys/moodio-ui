// 给管理员看的「系统状态」：磁盘、上次备份、OSS 用量、库里有多少东西、服务跑了多久。
// 目的是不看日志也能一眼判断健不健康，所以每一项都尽量给出能直接比较的数字；拿不到的项返回 null，前端写「未知」。
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.mjs';
import { blobsHealth, ossBackend } from './store.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(HERE, '..');
const REPO = path.resolve(SERVER_DIR, '..');
const STARTED = new Date();

export async function systemStatus() {
  const [disk, backup, storage, counts, commit] = await Promise.all([diskUsage('/'), lastBackup(), storageStatus(), dbCounts(), gitCommit()]);
  return {
    disk, backup, storage, db: counts,
    service: { startedAt: STARTED.toISOString(), node: process.version, commit, load1: os.loadavg()[0], memFree: os.freemem(), memTotal: os.totalmem() },
  };
}

async function diskUsage(p) {
  try { const s = await fs.statfs(p); const total = s.blocks * s.bsize, free = s.bavail * s.bsize; return { total, free, used: total - free }; }
  catch { return null; }
}

// 备份目录是 root 的 700，服务（wow 用户）读不了，所以 backup.sh 跑完单独写一份状态到 server/.backup-status.json
async function lastBackup() {
  try { return JSON.parse(await fs.readFile(path.join(SERVER_DIR, '.backup-status.json'), 'utf8')); }
  catch { return null; }
}

async function storageStatus() {
  const h = await blobsHealth();
  if (h.kind !== 'oss' || !h.ok) return h;
  try {
    const oss = await ossBackend();
    const { objects, truncated } = await oss.list('', { pages: 10 });     // 最多一万个对象，再多就标 truncated 估算
    const backups = objects.filter(o => o.key.startsWith('backups/')).sort((a, b) => (a.lastModified < b.lastModified ? 1 : -1));
    return { ...h, objects: objects.length, bytes: objects.reduce((a, o) => a + o.size, 0), truncated, backups: backups.length, lastBackupKey: backups[0]?.key || null, lastBackupAt: backups[0]?.lastModified || null };
  } catch (e) { return { ...h, listError: String(e.message) }; }
}

async function dbCounts() {
  try {
    const [r] = await db()`select
      (select count(*) from users)::int as users,
      (select count(*) from users where disabled_at is not null)::int as disabled,
      (select count(*) from projects where deleted_at is null)::int as projects,
      (select count(*) from docs where deleted_at is null)::int as docs,
      (select count(*) from media where deleted_at is null)::int as media,
      (select count(*) from media where deleted_at is not null and purged_at is null and object_key is not null)::int as media_pending_purge,
      (select count(*) from render_jobs where status in ('queued', 'running'))::int as render_active,
      (select count(*) from render_jobs where status = 'failed' and created_at > now() - interval '7 days')::int as render_failed_7d`;
    return r;
  } catch { return null; }
}

// 线上跑的是哪个提交：读 .git/HEAD（服务器上是 wow 用户的仓库，读文件不会撞「dubious ownership」）
async function gitCommit() {
  try {
    const head = (await fs.readFile(path.join(REPO, '.git', 'HEAD'), 'utf8')).trim();
    if (!head.startsWith('ref:')) return head.slice(0, 7);
    const ref = head.slice(5).trim();
    try { return (await fs.readFile(path.join(REPO, '.git', ref), 'utf8')).trim().slice(0, 7); }
    catch {
      const packed = await fs.readFile(path.join(REPO, '.git', 'packed-refs'), 'utf8');
      return (packed.split('\n').find(l => l.endsWith(' ' + ref)) || '').slice(0, 7);
    }
  } catch { return ''; }
}
