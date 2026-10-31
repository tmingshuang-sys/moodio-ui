// 把删掉超过 30 天的媒体对应的文件从存储里清掉。
// 前端删除是软删（回收站 7 天可恢复），服务端只记 deleted_at；文件没人删就会一直占着 OSS，账单慢慢涨。
// 30 天远大于回收站的 7 天，不会有人恢复时发现文件没了。只清文件、不删行：行留着同步才知道「这条删掉了」，
// object_key 置空、记 purged_at，下次不再碰。
import { db } from './db.mjs';
import { blobs } from './store.mjs';

export async function purgeDeletedMedia({ olderThanDays = 30, limit = 200 } = {}) {
  const s = db();
  const rows = await s`
    select id, object_key, size from media
    where deleted_at is not null and deleted_at < now() - make_interval(days => ${olderThanDays})
      and object_key is not null and purged_at is null
    order by deleted_at limit ${limit}`;
  let purged = 0, bytes = 0, failed = 0;
  for (const r of rows) {
    try {
      await blobs.del(r.object_key);
      await s`update media set object_key = null, purged_at = now() where id = ${r.id}`;
      purged++; bytes += Number(r.size || 0);
    } catch (e) { failed++; console.error('[purge]', r.id, e.message); }
  }
  return { purged, bytes, failed, more: rows.length === limit };
}

// 在服务进程里定时跑：启动一分钟后一次，之后每天一次。失败只记日志，不影响服务
export function schedulePurge(log = console.log) {
  const run = async () => {
    try {
      const r = await purgeDeletedMedia();
      if (r.purged || r.failed) log(`清理已删媒体：删了 ${r.purged} 个文件（${(r.bytes / 1048576).toFixed(1)} MB）${r.failed ? `，${r.failed} 个失败` : ''}`);
    } catch (e) { console.error('[purge]', e.message); }
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, 24 * 3600_000).unref();
}
