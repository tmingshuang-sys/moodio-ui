// ===== 数据同步：浏览器仍是主力存储，服务端是权威备份与多端交汇点 =====
// 协议刻意做得很笨（服务端 server/src/sync.mjs 同样）：拉比游标新的记录、推比库里新的记录，
// 冲突就是 last-write-wins，不做合并。笨的协议出了问题查得清楚。
//
// 一轮的顺序是 建项目 → 拉 → 合 → 推 → 存游标：
//   先拉后推，是为了不用把刚拉下来的东西原样再推一遍（推的时候按游标筛，并跳过这一轮刚合进来的 id）。
//   游标存的是服务端返回的 now（它的时钟），不是本机时间——两边时钟差几秒就会漏记录。
// 媒体二进制单独走 /api/media/:id：元数据先同步，文件随后补，所以换台机器会先看到卡片再看到图。
import type { Chat, Doc, MediaItem } from './types';
import { chatRow, docRow, localChanges, mediaAt, mediaRow, ms, planMerge, rowChat, rowDoc, rowMedia } from './sync-map';
import { useChats, useFiles, flushStores } from './store';
import { projects, clearFreshMark } from './projects';
import { getBlob, putBlob, cacheUrl, readJSON, writeJSON } from './storage';
import { serverToken } from './server';
import { create } from 'zustand';

const cursorKey = (pid: string) => `wow-sync-cursor::${pid}`;
const blobKey = (pid: string) => `wow-sync-blobs::${pid}`;   // 已经上传过文件的媒体 id，省得每轮都问一遍服务端

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';
interface SyncState { status: SyncStatus; at: number; error: string; pulled: number; pushed: number; }
export const useSync = create<SyncState>(() => ({ status: 'off', at: 0, error: '', pulled: 0, pushed: 0 }));

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), Authorization: 'Bearer ' + serverToken(), ...(init.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* 代理返回的 HTML 错误页 */ }
  if (!res.ok) throw new Error(data?.error?.message || `接口返回 ${res.status}`);
  return data as T;
}

// ---- 一轮同步 ----
let running: Promise<void> | null = null;

export function syncEnabled() { return !!serverToken(); }

// 这个创作从没被用过：没说过一句话、没有任何媒体、没有一份文稿被改过。
// 新装一台机器时本机那个默认创作就长这样（里面只有 sample.ts 的示例文稿），不该推上去——
// 不然每换一台机器账号里就多一个「我的项目」。用户一旦发一句话 / 传一个文件 / 改一个字，它就算用过了。
export function neverUsed(): boolean {
  const f = useFiles.getState();
  return !useChats.getState().chats.some(c => c.messages.length)
    && !f.media.length && !f.trash.length
    && f.docs.every(d => d.updatedAt === d.createdAt);
}

export async function syncNow(): Promise<void> {
  if (!syncEnabled()) { useSync.setState({ status: 'off' }); return; }
  if (running) return running;                       // 同一时刻只跑一轮，重复调用等它
  running = round(projects.active().id).finally(() => { running = null; });
  return running;
}

async function round(pid: string) {
  // 全程以进来时的 pid 为准：中途用户切了创作就放弃这一轮，也不写游标，免得把新创作的数据
  // 推到旧创作名下、或者把旧创作的游标推进到一个没真正合完的时间点
  const stale = () => projects.active().id !== pid;
  // 还没被用过、而且从没同步过的创作直接跳过：它里面只有示例文稿
  if (neverUsed() && !readJSON<string>(cursorKey(pid), '')) { useSync.setState({ status: 'idle', error: '' }); return; }
  useSync.setState({ status: 'syncing', error: '' });
  try {
    flushStores();                                   // 把挂起的保存先写盘，免得推的是上一秒的数据
    const since = readJSON<string>(cursorKey(pid), '');

    await call('/api/projects', { method: 'POST', body: JSON.stringify({ id: pid, title: projects.active().title, brief: useFiles.getState().brief }) });
    if (stale()) return;

    // 1. 拉
    const remote = await call<any>('/api/sync/pull', { method: 'POST', body: JSON.stringify({ projectId: pid, since: since || undefined }) });
    if (stale()) return;
    const applied = mergeRemote(remote);

    // 2. 推（只推比游标新的，且跳过这一轮刚合进来的——那些就是从服务端下来的）
    const payload = changesNow(since, applied.ids);
    let pushed = 0;
    if (payload.docs.length || payload.media.length || payload.chats.length) {
      const r = await call<any>('/api/sync/push', { method: 'POST', body: JSON.stringify({ projectId: pid, ...payload }) });
      pushed = Object.values(r?.applied || {}).reduce((a: number, b: any) => a + Number(b || 0), 0);
    }

    writeJSON(cursorKey(pid), remote.now);           // 用服务端的时钟，不是本机的
    if (!stale()) await syncBlobs(pid, remote);
    useSync.setState({ status: 'idle', at: Date.now(), error: '', pulled: applied.count, pushed });
  } catch (e: any) {
    useSync.setState({ status: 'error', error: String(e?.message || e) });
  }
}

interface Applied { ids: Set<string>; count: number }

function mergeRemote(remote: any): Applied {
  const files = useFiles.getState(), chats = useChats.getState();
  const side = { docs: files.docs, media: files.media, trash: files.trash, chats: chats.chats };
  const freeze = new Set(chats.chats.filter(c => c.messages.some(m => m.streaming)).map(c => c.id));
  const plan = planMerge(side, remote, freeze);
  if (plan.docs.length || plan.media.length || plan.removeDocs.length || plan.removeMedia.length) {
    files.applyRemote({ docs: plan.docs, media: plan.media, removeDocs: plan.removeDocs, removeMedia: plan.removeMedia });
  }
  if (plan.chats.length || plan.removeChats.length) chats.applyRemote(plan.chats, plan.removeChats);
  return { ids: plan.ids, count: plan.ids.size };
}

function changesNow(since: string, skip: Set<string>) {
  const f = useFiles.getState(), c = useChats.getState();
  return localChanges({ docs: f.docs, media: f.media, trash: f.trash, chats: c.chats }, since, skip);
}

// ---- 媒体二进制：本机有文件而服务端没有就传上去，本机没有而服务端有就下回来 ----
// 不能只看这一轮拉回来的那几行：增量拉只返回「比游标新」的记录，一张早就同步过元数据、
// 但本机还没拿到文件的图永远不会再出现在里面（hydrateProject 之后就是这个情形，实测踩到过）。
// 所以以本机的媒体清单为准，逐条看「有没有文件」。
const BLOB_BATCH = 20;
async function syncBlobs(pid: string, remote: any) {
  const uploaded = new Set(readJSON<string[]>(blobKey(pid), []));
  const absent = new Set(readJSON<string[]>(blobKey(pid) + '::absent', []));   // 服务端确实没有文件的，别每轮都问
  const remoteKey = new Map<string, string | null>((remote.media || []).map((r: any) => [r.id, r.object_key]));
  const media = useFiles.getState().media;
  let up = 0, down = 0;

  for (const m of media) {
    if (up >= BLOB_BATCH && down >= BLOB_BATCH) break;
    const mine = await getBlob(m.id).catch(() => null);
    if (mine) {
      // 本机有文件：没传过就传上去
      if (uploaded.has(m.id) || remoteKey.get(m.id) || up >= BLOB_BATCH) { uploaded.add(m.id); continue; }
      try {
        await call(`/api/media/${m.id}`, { method: 'PUT', body: mine as any, headers: { 'Content-Type': m.mime || 'application/octet-stream' } });
        uploaded.add(m.id); absent.delete(m.id); up++;
      } catch { /* 下一轮再试 */ }
      continue;
    }
    // 本机没有文件：从服务端取。取不到就记下来，别每轮都问一遍
    if (absent.has(m.id) || down >= BLOB_BATCH) continue;
    try {
      const res = await fetch(`/api/media/${m.id}`, { headers: { Authorization: 'Bearer ' + serverToken() } });
      if (!res.ok) { absent.add(m.id); continue; }
      const blob = await res.blob();
      await putBlob(m.id, blob); cacheUrl(m.id, blob); uploaded.add(m.id); down++;
    } catch { /* 下一轮再试 */ }
  }
  writeJSON(blobKey(pid), [...uploaded]);
  writeJSON(blobKey(pid) + '::absent', [...absent]);
  return { up, down };
}

// ---- 自动同步：改完安静 4 秒推一次，切后台立刻推，打开页面先拉一次 ----
let timer = 0;
export function scheduleSync(delay = 4000) {
  if (!syncEnabled() || running) return;             // 正在跑的那一轮自己会把最新状态带上
  clearTimeout(timer);
  timer = window.setTimeout(() => { void syncNow(); }, delay);
}

let started = false;
export function startAutoSync() {
  if (started) return; started = true;
  // 只认数据变化：界面偏好（拖分栏、开合工作区）也在同一个仓库里，不该触发同步
  useFiles.subscribe((s, p) => { if (s.docs !== p.docs || s.media !== p.media || s.trash !== p.trash || s.brief !== p.brief) scheduleSync(); });
  useChats.subscribe((s, p) => { if (s.chats !== p.chats) scheduleSync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); void syncNow(); } });
  if (syncEnabled()) void syncNow();
}

// 离开一个创作（切换 / 新建）时把它这边的改动推走。
// 必须在仓库换成新项目之前**同步地**把要推的东西读出来，之后的网络请求再慢也不会串项目；
// 这一轮不动游标，所以下次打开这个创作还会再推一遍（服务端比 updated_at，重复推是空操作）。
export function pushAway() {
  if (!syncEnabled()) return;
  const pid = projects.active().id, title = projects.active().title;
  const brief = useFiles.getState().brief;
  const payload = changesNow(readJSON<string>(cursorKey(pid), ''), new Set());
  if (!payload.docs.length && !payload.media.length && !payload.chats.length) return;
  void (async () => {
    try {
      await call('/api/projects', { method: 'POST', body: JSON.stringify({ id: pid, title, brief }) });
      await call('/api/sync/push', { method: 'POST', body: JSON.stringify({ projectId: pid, ...payload }) });
    } catch { /* 下次打开这个创作时补上 */ }
  })();
}

// ---- 首次登录 / 换一台机器：把服务端已有的创作全部取回来 ----
// 不是当前打开的那个创作就不能走仓库（仓库里永远只有当前项目的数据），
// 直接写它自己的 localStorage 键——和 library.ts 读别的项目是同一个路子。
export async function pullAllProjects(onStep?: (done: number, total: number) => void): Promise<{ count: number; goTo: string | null; dropped: string | null }> {
  if (!syncEnabled()) return { count: 0, goTo: null, dropped: null };
  // 这台机器是不是刚装好、还没用过：只有一个创作、从没同步过、没有任何一条说过话的对话。
  // 是的话它里面只有示例文稿，别把它当成一个创作推上去——不然每换一台机器账号里就多一个「我的项目」
  const virgin = projects.list().length === 1 && neverUsed();
  const hometown = projects.active().id;

  const { projects: rows } = await call<{ projects: any[] }>('/api/projects');
  const live = rows.filter(r => !r.deleted_at && r.id !== hometown);
  let n = 0;
  for (const [i, r] of live.entries()) {
    onStep?.(i, live.length);
    projects.adopt({ id: r.id, title: r.title, createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) });
    try { await hydrateProject(r.id, r.brief); n++; } catch { /* 这个创作下次再说 */ }
  }
  onStep?.(live.length, live.length);
  if (!live.length) { await syncNow(); return { count: 0, goTo: null, dropped: null }; }

  // 取回来了就跳到服务端最近改过的那个；空白机器上那个只有示例文稿的本地创作顺手清掉
  const newest = live.slice().sort((a, b) => ms(b.updated_at) - ms(a.updated_at))[0];
  return { count: n, goTo: newest.id, dropped: virgin ? hometown : null };
}

// 把一个「不是当前打开」的创作整份拉下来写进它自己的存储键。只做拉、不做推：
// 本机既然还没有它，就没有能推的改动
async function hydrateProject(pid: string, brief: any) {
  const since = readJSON<string>(cursorKey(pid), '');
  const remote = await call<any>('/api/sync/pull', { method: 'POST', body: JSON.stringify({ projectId: pid, since: since || undefined }) });

  const fkey = `moodio-files-v1::${pid}`, ckey = `moodio-agent-chats::${pid}`;
  const files = readJSON<any>(fkey, null) || { docs: [], media: [], trash: [], brief: {}, ui: {} };
  const merge = <T extends { id: string }>(mine: T[], rows: any[], at: (x: T) => number, to: (r: any) => T) => {
    const out = mine.slice();
    for (const r of rows) {
      const i = out.findIndex(x => x.id === r.id);
      if (r.deleted_at) { if (i >= 0) out.splice(i, 1); continue; }
      if (i < 0) out.unshift(to(r));
      else if (at(out[i]) < ms(r.updated_at)) out[i] = to(r);
    }
    return out;
  };
  files.docs = merge<Doc>(files.docs || [], remote.docs || [], d => d.updatedAt, rowDoc);
  files.media = merge<MediaItem>(files.media || [], remote.media || [], mediaAt, rowMedia);
  files.brief = { ...(files.brief || {}), ...(brief || {}) };
  writeJSON(fkey, files);

  const chats = readJSON<any>(ckey, null) || { chats: [], active: '' };
  chats.chats = merge<Chat>(chats.chats || [], remote.chats || [], c => c.at, rowChat).sort((a, b) => b.at - a.at).slice(0, 60);
  if (!chats.chats.some((c: Chat) => c.id === chats.active)) chats.active = chats.chats[0]?.id || '';
  writeJSON(ckey, chats);

  writeJSON(cursorKey(pid), remote.now);
  clearFreshMark(pid);   // 数据已经填进去了，别再按「全新空白项目」加载
}
