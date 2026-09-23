// ===== 状态仓库（zustand）：文件（文稿 / 媒体 / 回收站 / 纲领 / 界面偏好）、对话、Agent 运行态 =====
// 文件与对话按项目持久化到 localStorage（键见 projects.key），媒体 blob 在 IndexedDB（storage.ts）。
import { create } from 'zustand';
import type { Brief, Chat, Doc, DocKind, MediaItem, Message, Origin, TrashEntry, UiPrefs } from './types';
import { uid } from './types';
import { projects, NEW_PROJECT_TITLE, isFreshProject, clearFreshMark } from './projects';
import { readJSON, writeJSON, putBlob, dataUrlToBlob, cacheUrl } from './storage';
import { ensureExt, kindFromName, uniqueName, sanitizeName } from './markdown';
import { migrateLegacyWorkspace } from './migrate';
import { sampleDocs } from './sample';

// 键按当前项目动态取：切换创作（项目）时 reload() 整体换数据，不刷新页面
const filesKey = () => projects.key('moodio-files-v1');
const chatsKey = () => projects.key('moodio-agent-chats');
const DEFAULT_UI: UiPrefs = { paneOpen: true, paneWidth: 0, view: 'grid', openId: null, sidebarCollapsed: false };

interface FilesSnapshot { docs: Doc[]; media: MediaItem[]; trash: TrashEntry[]; brief: Brief; ui: UiPrefs; }

let filesNeedSave = false;   // 迁移或示例生成的首份数据要立刻落盘，否则每次刷新都会重新迁移、id 变化
function loadFiles(): FilesSnapshot {
  filesNeedSave = false;
  const saved = readJSON<FilesSnapshot | null>(filesKey(), null);
  if (saved && Array.isArray(saved.docs)) return { docs: saved.docs, media: saved.media || [], trash: saved.trash || [], brief: saved.brief || {}, ui: { ...DEFAULT_UI, ...(saved.ui || {}) } };
  filesNeedSave = true;
  // 第一次用新版打开这个项目：先把旧版原型的剧本 / 文档 / 资产迁移成文件；没有旧数据的全新项目给一组示例文稿
  const legacy = migrateLegacyWorkspace(projects.active().id);
  if (legacy) {
    const pending = legacy.media;
    queueMicrotask(async () => { for (const m of pending) { const blob = dataUrlToBlob(m.dataUrl); if (!blob) continue; try { await putBlob(m.meta.id, blob); cacheUrl(m.meta.id, blob); } catch { /* ignore */ } } });
    return { docs: legacy.docs, media: legacy.media.map(m => m.meta), trash: [], brief: legacy.brief || {}, ui: { ...DEFAULT_UI } };
  }
  // 新建的空白项目：没有示例文稿，工作区默认收起、只留对话框；有产物时 openInPane() 会自动打开
  const fresh = isFreshProject(projects.active().id); clearFreshMark(projects.active().id);
  return { docs: fresh ? [] : sampleDocs(), media: [], trash: [], brief: {}, ui: { ...DEFAULT_UI, paneOpen: !fresh } };
}

interface FilesState extends FilesSnapshot {
  addDoc(input: { name: string; content?: string; kind?: DocKind; by?: Origin; chatId?: string | null }): Doc;
  updateDoc(id: string, patch: Partial<Doc>): void;
  renameDoc(id: string, name: string): boolean;
  removeDoc(id: string): TrashEntry | null;
  addMedia(meta: MediaItem): void;
  updateMedia(id: string, patch: Partial<MediaItem>): void;
  removeMedia(id: string): TrashEntry | null;
  restoreTrash(trashId: string): TrashEntry | null;
  setBrief(patch: Brief): void;
  setUi(patch: Partial<UiPrefs>): void;
  openInPane(id: string | null): void;
  reload(): void;   // 按当前项目重新读一遍（切换 / 新建创作时用）
}

let saveTimer = 0, filesDirty = false;
function writeFilesNow(get: () => FilesState) {
  clearTimeout(saveTimer); if (!filesDirty) return; filesDirty = false;
  const s = get(); writeJSON(filesKey(), { docs: s.docs, media: s.media, trash: s.trash, brief: s.brief, ui: s.ui }); projects.touch();
}
function persistFiles(get: () => FilesState) {
  filesDirty = true; clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => writeFilesNow(get), 120);
}
const pruneTrash = (trash: TrashEntry[]) => trash.filter(e => Date.now() - e.deletedAt < 7 * 864e5).slice(0, 60);

export const useFiles = create<FilesState>((set, get) => ({
  ...loadFiles(),
  addDoc({ name, content = '', kind, by = 'user', chatId = null }) {
    const finalKind = kind || kindFromName(name);
    const finalName = uniqueName(get().docs.map(d => d.name), ensureExt(sanitizeName(name), finalKind));
    const doc: Doc = { id: uid('d'), name: finalName, kind: finalKind, content, createdAt: Date.now(), updatedAt: Date.now(), by, chatId };
    set(s => ({ docs: [doc, ...s.docs] })); persistFiles(get); return doc;
  },
  updateDoc(id, patch) {
    set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, ...patch, updatedAt: patch.content !== undefined && patch.content !== d.content ? Date.now() : (patch.updatedAt ?? d.updatedAt) } : d) }));
    persistFiles(get);
  },
  renameDoc(id, name) {
    const doc = get().docs.find(d => d.id === id); if (!doc) return false;
    const finalName = uniqueName(get().docs.filter(d => d.id !== id).map(d => d.name), ensureExt(sanitizeName(name), doc.kind));
    set(s => ({ docs: s.docs.map(d => d.id === id ? { ...d, name: finalName, kind: kindFromName(finalName) } : d) })); persistFiles(get); return true;
  },
  removeDoc(id) {
    const doc = get().docs.find(d => d.id === id); if (!doc) return null;
    const entry: TrashEntry = { trashId: uid('t'), deletedAt: Date.now(), doc };
    set(s => ({ docs: s.docs.filter(d => d.id !== id), trash: pruneTrash([entry, ...s.trash]), ui: s.ui.openId === id ? { ...s.ui, openId: null } : s.ui }));
    persistFiles(get); return entry;
  },
  addMedia(meta) { set(s => ({ media: [meta, ...s.media.filter(m => m.id !== meta.id)] })); persistFiles(get); },
  updateMedia(id, patch) { set(s => ({ media: s.media.map(m => m.id === id ? { ...m, ...patch } : m) })); persistFiles(get); },
  removeMedia(id) {
    const media = get().media.find(m => m.id === id); if (!media) return null;
    const entry: TrashEntry = { trashId: uid('t'), deletedAt: Date.now(), media };
    set(s => ({ media: s.media.filter(m => m.id !== id), trash: pruneTrash([entry, ...s.trash]), ui: s.ui.openId === id ? { ...s.ui, openId: null } : s.ui }));
    persistFiles(get); return entry;
  },
  restoreTrash(trashId) {
    const entry = get().trash.find(e => e.trashId === trashId); if (!entry) return null;
    set(s => ({
      trash: s.trash.filter(e => e !== entry),
      docs: entry.doc ? [{ ...entry.doc, name: uniqueName(s.docs.map(d => d.name), entry.doc.name) }, ...s.docs] : s.docs,
      media: entry.media ? [entry.media, ...s.media] : s.media,
    }));
    persistFiles(get); return entry;
  },
  setBrief(patch) { set(s => ({ brief: { ...s.brief, ...patch, updatedAt: Date.now() } })); persistFiles(get); },
  setUi(patch) { set(s => ({ ui: { ...s.ui, ...patch } })); persistFiles(get); },
  openInPane(id) { set(s => ({ ui: { ...s.ui, openId: id, paneOpen: true } })); persistFiles(get); },
  reload() { filesDirty = false; clearTimeout(saveTimer); set(loadFiles()); if (filesNeedSave) persistFiles(get); },
}));

if (filesNeedSave) persistFiles(useFiles.getState);

export const findDoc = (id: string | null | undefined) => (id ? useFiles.getState().docs.find(d => d.id === id) || null : null);
export const findMedia = (id: string | null | undefined) => (id ? useFiles.getState().media.find(m => m.id === id) || null : null);
export const findDocByName = (name: string) => { const n = String(name || '').trim().toLowerCase(); return useFiles.getState().docs.find(d => d.name.toLowerCase() === n || d.name.toLowerCase() === n + '.md') || null; };

// ===== 对话 =====
interface ChatsSnapshot { chats: Chat[]; active: string; }
function loadChats(): ChatsSnapshot {
  const saved = readJSON<any>(chatsKey(), null);
  if (saved && Array.isArray(saved.chats) && saved.chats.length) {
    const chats: Chat[] = saved.chats.map((c: any) => ({ id: String(c.id), title: String(c.title || '新对话'), messages: Array.isArray(c.messages) ? c.messages : [], at: Number(c.at) || Date.now() }));
    const active = chats.some(c => c.id === saved.active) ? saved.active : chats[0].id;
    return { chats, active };
  }
  const first: Chat = { id: uid('c'), title: '新对话', messages: [], at: Date.now() };
  return { chats: [first], active: first.id };
}
interface ChatsState extends ChatsSnapshot {
  chat(): Chat;
  newChat(): Chat;
  setActive(id: string): void;
  renameChat(id: string, title: string): void;
  deleteChat(id: string): void;
  push(chatId: string, message: Message): void;
  mutate(fn: (chats: Chat[]) => void): void;   // 原地修改后提交（流式更新用）
  reload(activeId?: string): void;            // 按当前项目重新读一遍，可指定激活哪个对话
}
let chatsTimer = 0, chatsDirty = false;
function writeChatsNow(get: () => ChatsState) {
  clearTimeout(chatsTimer); if (!chatsDirty) return; chatsDirty = false;
  const s = get(); writeJSON(chatsKey(), { chats: s.chats.slice(0, 60), active: s.active });
}
function persistChats(get: () => ChatsState) {
  chatsDirty = true; clearTimeout(chatsTimer);
  chatsTimer = window.setTimeout(() => writeChatsNow(get), 120);
}
// 切换项目前把两边挂起的保存立刻写进「当前」项目的键，免得定时器在切换之后把旧数据写到新项目里
export function flushStores() { writeFilesNow(useFiles.getState); writeChatsNow(useChats.getState); }
export const useChats = create<ChatsState>((set, get) => ({
  ...loadChats(),
  chat() { const s = get(); return s.chats.find(c => c.id === s.active) || s.chats[0]; },
  newChat() {
    const current = get().chat();
    if (current && !current.messages.length) { set({ active: current.id }); return current; }   // 当前已是空对话就直接复用
    const c: Chat = { id: uid('c'), title: '新对话', messages: [], at: Date.now() };
    set(s => ({ chats: [c, ...s.chats].slice(0, 60), active: c.id })); persistChats(get); return c;
  },
  setActive(id) { if (get().chats.some(c => c.id === id)) { set({ active: id }); persistChats(get); } },
  renameChat(id, title) { const t = String(title || '').trim(); if (!t) return; set(s => ({ chats: s.chats.map(c => c.id === id ? { ...c, title: t } : c) })); persistChats(get); },
  deleteChat(id) {
    set(s => { const chats = s.chats.filter(c => c.id !== id); if (!chats.length) chats.push({ id: uid('c'), title: '新对话', messages: [], at: Date.now() }); return { chats, active: s.active === id ? chats[0].id : s.active }; });
    persistChats(get);
  },
  push(chatId, message) {
    const named = { title: '' };
    set(s => ({ chats: s.chats.map(c => {
      if (c.id !== chatId) return c;
      const title = c.title === '新对话' && message.role === 'user' && !message.display ? (message.text.replace(/\s+/g, ' ').slice(0, 24) || '新对话') : c.title;   // 问卷提交（有 display）不拿来当标题，由导演按类型和主题命名
      if (title !== c.title) named.title = title;
      return { ...c, messages: [...c.messages, message], at: Date.now(), title };
    }) }));
    // 点「创作」建出的项目还叫「新创作」：第一句话发出后项目名跟着对话标题走
    if (named.title && projects.active().title === NEW_PROJECT_TITLE) projects.rename(projects.active().id, named.title);
    persistChats(get);
  },
  // 原地改完后给每个对话换一个新的对象引用（消息对象本身不换，执行器还攥着 pending / out 的引用）：
  // 组件按对话对象订阅（ChatPane 选的是 chat 本身），只换外层数组不会触发重渲染，之前「取消计划」就是这样卡在待确认态的
  mutate(fn) { const chats = get().chats; fn(chats); set({ chats: chats.map(c => ({ ...c, messages: c.messages.slice() })) }); persistChats(get); },
  reload(activeId) {
    chatsDirty = false; clearTimeout(chatsTimer);
    const snap = loadChats();
    if (activeId && snap.chats.some(c => c.id === activeId)) snap.active = activeId;
    set(snap); persistChats(get);
  },
}));

// ===== 页面导航（不持久化）：chat = 对话 + 工作区，library = 素材库（所有创作里的图片与视频）=====
export type Page = 'chat' | 'library';
export const useNav = create<{ page: Page; go: (page: Page) => void }>(set => ({ page: 'chat', go: page => set({ page }) }));

// ===== Agent 运行态（不持久化）=====
export interface Writing { docId: string; text: string; }
interface AgentState {
  busy: boolean; live: string; glow: boolean; writing: Writing | null; abortRequested: boolean; controller: AbortController | null;
  round: { kind: string; startedAt: number } | null;   // 正在等模型的这一轮：界面按它显示「已用 N 秒 · 通常 M 秒」
  set(patch: Partial<AgentState>): void;
}
export const useAgent = create<AgentState>(set => ({ busy: false, live: '', glow: false, writing: null, abortRequested: false, controller: null, round: null, set: patch => set(patch) }));
