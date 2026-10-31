// 数据同步：浏览器仍然是主力存储（离线可用、改动即时），服务端是权威备份与多端的交汇点。
// 协议刻意做得很笨，因为笨的协议才查得清楚：
//   pull(projectId, since) → 比 since 新的记录（含软删的）
//   push(projectId, 记录数组) → 逐条比 updated_at，比库里新才覆盖
// 冲突就是 last-write-wins，不做合并；真撞上了由前端提示用户，不在服务端猜。
// 媒体二进制走另一条路（/api/media/:id 上传下载），这里只同步元数据。
import { db } from './db.mjs';

const TABLES = {
  docs: ['id', 'project_id', 'name', 'kind', 'content', 'by', 'chat_id', 'created_at', 'updated_at', 'deleted_at'],
  media: ['id', 'project_id', 'name', 'kind', 'mime', 'size', 'grp', 'by', 'width', 'height', 'model', 'duration', 'voice_id', 'compose', 'object_key', 'created_at', 'updated_at', 'deleted_at'],
  chats: ['id', 'project_id', 'title', 'messages', 'created_at', 'updated_at', 'deleted_at'],
};

async function ownProject(userId, projectId) {
  const [p] = await db()`select id from projects where id = ${projectId} and user_id = ${userId}`;
  return !!p;
}

export async function ensureProject(userId, { id, title = '新创作', brief = {} }) {
  const s = db();
  await s`
    insert into projects (id, user_id, title, brief) values (${id}, ${userId}, ${title}, ${s.json(brief)})
    on conflict (id) do update set title = excluded.title, brief = excluded.brief, updated_at = now()
    where projects.user_id = ${userId}`;
  return ownProject(userId, id);
}

export async function listProjects(userId) {
  return db()`select id, title, brief, created_at, updated_at, deleted_at from projects where user_id = ${userId} order by updated_at desc`;
}

export async function pull(userId, projectId, since) {
  if (!(await ownProject(userId, projectId))) throw new Error('没有这个创作，或者它不属于你');
  const s = db();
  const at = since ? new Date(since) : new Date(0);
  const out = { since: at.toISOString(), now: new Date().toISOString() };
  for (const [table, cols] of Object.entries(TABLES)) {
    out[table] = await s`select ${s(cols)} from ${s(table)} where project_id = ${projectId} and updated_at > ${at} order by updated_at`;
  }
  return out;
}

export async function push(userId, projectId, payload) {
  if (!(await ownProject(userId, projectId))) throw new Error('没有这个创作，或者它不属于你');
  const s = db();
  const applied = {};
  for (const [table, cols] of Object.entries(TABLES)) {
    const rows = Array.isArray(payload[table]) ? payload[table] : [];
    let n = 0;
    for (const raw of rows) {
      if (!raw?.id) continue;
      const row = { ...raw, project_id: projectId };
      for (const k of ['created_at', 'updated_at', 'deleted_at']) if (row[k]) row[k] = new Date(row[k]);
      if (!row.updated_at) row.updated_at = new Date();
      for (const k of ['compose', 'messages']) if (k in row && row[k] != null && typeof row[k] !== 'string') row[k] = s.json(row[k]);
      const use = cols.filter(c => c in row);
      const update = use.filter(c => c !== 'id' && c !== 'created_at');
      // 只有推上来的比库里新才覆盖：同一条记录在两台机器上都改过时，晚改的赢
      const r = await s`
        insert into ${s(table)} ${s(row, use)}
        on conflict (id) do update set ${s(row, update)}
        where ${s(table)}.updated_at < excluded.updated_at
        returning id`;
      n += r.length;
    }
    applied[table] = n;
  }
  await s`update projects set updated_at = now() where id = ${projectId}`;
  return applied;
}
