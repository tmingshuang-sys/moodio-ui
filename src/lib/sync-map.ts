// ===== 同步的纯函数层：本地记录 ↔ 库表行、挑出要推的东西、合并拉回来的东西 =====
// 单独一个文件是为了能在 node 里直接测（不碰仓库、不碰 localStorage、不碰 IndexedDB）。
// 字段名两边不一样（group/grp、驼峰/下划线、毫秒/ISO），映射只写在这里一处，别处不许再手写。
import type { Brief, Chat, Doc, MediaItem, TrashEntry } from './types';

export const ms = (v: any) => (v ? new Date(v).getTime() : 0);
export const iso = (n: number | undefined) => new Date(n || Date.now()).toISOString();
export const mediaAt = (m: MediaItem) => m.updatedAt || m.createdAt;   // 老数据没有 updatedAt

export const docRow = (d: Doc, deletedAt?: number) => ({
  id: d.id, name: d.name, kind: d.kind, content: d.content, by: d.by, chat_id: d.chatId || null,
  created_at: iso(d.createdAt), updated_at: iso(deletedAt || d.updatedAt), deleted_at: deletedAt ? iso(deletedAt) : null,
});
export const rowDoc = (r: any): Doc => ({
  id: r.id, name: r.name, kind: r.kind, content: r.content || '', by: r.by, chatId: r.chat_id,
  createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
});
export const mediaRow = (m: MediaItem, deletedAt?: number) => ({
  id: m.id, name: m.name, kind: m.kind, mime: m.mime, size: m.size, grp: m.group, by: m.by,
  width: m.width ?? null, height: m.height ?? null, model: m.model ?? null, duration: m.duration ?? null,
  voice_id: m.voiceId ?? null, compose: m.compose ?? null,
  created_at: iso(m.createdAt), updated_at: iso(deletedAt || mediaAt(m)), deleted_at: deletedAt ? iso(deletedAt) : null,
});
export const rowMedia = (r: any): MediaItem => ({
  id: r.id, name: r.name, kind: r.kind, mime: r.mime || '', size: Number(r.size) || 0, group: r.grp || '其他', by: r.by,
  createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
  ...(r.width != null ? { width: Number(r.width) } : {}), ...(r.height != null ? { height: Number(r.height) } : {}),
  ...(r.model ? { model: r.model } : {}), ...(r.duration != null ? { duration: Number(r.duration) } : {}),
  ...(r.voice_id ? { voiceId: r.voice_id } : {}), ...(r.compose ? { compose: r.compose } : {}),
});
export const chatRow = (c: Chat) => ({ id: c.id, title: c.title, messages: c.messages, created_at: iso(c.at), updated_at: iso(c.at), deleted_at: null });
export const rowChat = (r: any): Chat => ({ id: r.id, title: r.title || '新对话', messages: Array.isArray(r.messages) ? r.messages : [], at: ms(r.updated_at) });

// ---- 要推上去的：比游标新、且不是这一轮刚从服务端合进来的 ----
export interface LocalSide { docs: Doc[]; media: MediaItem[]; trash: TrashEntry[]; chats: Chat[]; }
export function localChanges(side: LocalSide, since: string, skip: Set<string> = new Set()) {
  const at = since ? new Date(since).getTime() : 0;
  const fresh = (id: string, when: number) => when > at && !skip.has(id);
  return {
    docs: side.docs.filter(d => fresh(d.id, d.updatedAt)).map(d => docRow(d))
      // 回收站里的进同一张表，带上 deleted_at——不然「没推上来」和「删掉了」在服务端分不出来
      .concat(side.trash.filter(e => e.doc && fresh(e.doc.id, e.deletedAt)).map(e => docRow(e.doc!, e.deletedAt))),
    media: side.media.filter(m => fresh(m.id, mediaAt(m))).map(m => mediaRow(m))
      .concat(side.trash.filter(e => e.media && fresh(e.media.id, e.deletedAt)).map(e => mediaRow(e.media!, e.deletedAt))),
    chats: side.chats.filter(c => fresh(c.id, c.at) && c.messages.length).map(chatRow),
  };
}

// ---- 拉回来的怎么合：逐条比时间，本地更新就留着（下一步会被推上去），远端更新才覆盖 ----
export interface MergePlan {
  docs: Doc[]; media: MediaItem[]; chats: Chat[];
  removeDocs: string[]; removeMedia: string[]; removeChats: string[];
  ids: Set<string>;
}
export function planMerge(side: LocalSide, remote: any, freeze: Set<string> = new Set()): MergePlan {
  const out: MergePlan = { docs: [], media: [], chats: [], removeDocs: [], removeMedia: [], removeChats: [], ids: new Set() };
  const take = <T>(id: string, mine: T | undefined, mineAt: number, remoteRow: any, list: T[], remove: string[], to: (r: any) => T) => {
    if (remoteRow.deleted_at) { if (mine) { remove.push(id); out.ids.add(id); } return; }
    if (mine && mineAt >= ms(remoteRow.updated_at)) return;    // 本地更新，等下一步推上去
    list.push(to(remoteRow)); out.ids.add(id);
  };
  for (const r of remote.docs || []) {
    const mine = side.docs.find(d => d.id === r.id);
    take(r.id, mine, mine?.updatedAt ?? 0, r, out.docs, out.removeDocs, rowDoc);
  }
  for (const r of remote.media || []) {
    const mine = side.media.find(m => m.id === r.id);
    take(r.id, mine, mine ? mediaAt(mine) : 0, r, out.media, out.removeMedia, rowMedia);
  }
  for (const r of remote.chats || []) {
    if (freeze.has(r.id)) continue;                             // 正在流式输出的那条不碰
    const mine = side.chats.find(c => c.id === r.id);
    take(r.id, mine, mine?.at ?? 0, r, out.chats, out.removeChats, rowChat);
  }
  return out;
}

export const briefOf = (remote: any): Brief | undefined => (remote && typeof remote === 'object' ? remote as Brief : undefined);
