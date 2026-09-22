// ===== 创作会话：「创作」= 新建一个空白项目并切换过去；切换 / 删除创作都不刷新页面 =====
// 一次创作 = 一个项目（对话 + 工作区文件）。左侧「创作历史」列出所有项目里有内容的对话，点一条就切回那个项目。
import type { Chat, ProjectMeta } from './types';
import { projects, NEW_PROJECT_TITLE } from './projects';
import { useFiles, useChats, useAgent, flushStores } from './store';
import { readJSON, writeJSON } from './storage';
import { toast } from '../components/Toast';

const CHATS_BASE = 'moodio-agent-chats';
const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));
const readChats = (projectId: string): Chat[] => { const saved = readJSON<any>(`${CHATS_BASE}::${projectId}`, null); return Array.isArray(saved?.chats) ? saved.chats : []; };

function afterSwitch() {
  useAgent.getState().set({ live: '', glow: false, writing: null });
  document.title = `${projects.active().title} · Moodio`;
  emit('moodio:project-changed'); emit('moodio:focus-composer');
}
function blockedByAgent(): boolean {
  if (!useAgent.getState().busy) return false;
  toast('请等待当前 Agent 任务完成，或先点「停止」。'); return true;
}
function reloadStores(chatId?: string) { useFiles.getState().reload(); useChats.getState().reload(chatId); afterSwitch(); }

// 当前创作是不是一片空白（没文件、没消息）：是的话点「创作」直接复用，不再建一个空项目
export function isBlankCreation(): boolean {
  const f = useFiles.getState(); const c = useChats.getState().chat();
  return !f.docs.length && !f.media.length && !c.messages.length;
}

// 其他项目里还没用过的空白「新创作」（没文件、没消息）：再点「创作」时直接切回去，免得攒出一堆空项目
function findBlankProject(): ProjectMeta | null {
  const active = projects.active().id;
  return projects.list().filter(p => p.id !== active && p.title === NEW_PROJECT_TITLE).sort((a, b) => b.createdAt - a.createdAt).find(p => {
    const files = readJSON<any>(`moodio-files-v1::${p.id}`, null);
    return !(files?.docs?.length || files?.media?.length) && !readChats(p.id).some(c => Array.isArray(c.messages) && c.messages.length);
  }) || null;
}

// 「创作」按钮：新建空白项目并切过去。工作区默认收起、对话为空；原来的对话与文件留在原项目里，出现在创作历史中
export function startCreation(title = NEW_PROJECT_TITLE, { reuseBlank = true } = {}): ProjectMeta | null {
  if (blockedByAgent()) return null;
  if (reuseBlank && isBlankCreation() && projects.active().title === NEW_PROJECT_TITLE) { emit('moodio:focus-composer'); return projects.active(); }
  const blank = reuseBlank ? findBlankProject() : null;
  if (blank) { switchProject(blank.id); return blank; }
  flushStores();
  const p = projects.create(title, { reload: false });
  reloadStores();
  return p;
}

export function switchProject(id: string, chatId?: string): boolean {
  if (blockedByAgent()) return false;
  if (id === projects.active().id) { if (chatId) useChats.getState().setActive(chatId); return true; }
  flushStores();
  if (!projects.switchTo(id, { reload: false })) return false;
  reloadStores(chatId);
  return true;
}

// 删除一次创作（项目连同它的对话与工作区文件）。删的是当前项目就切到最近改动的另一个；只剩它一个时清空成新创作
export function deleteCreation(id: string): boolean {
  if (blockedByAgent()) return false;
  const list = projects.list(); if (!list.some(p => p.id === id)) return false;
  const isActive = id === projects.active().id;
  if (list.length <= 1) { flushStores(); projects.clearData(id); projects.rename(id, NEW_PROJECT_TITLE); reloadStores(); return true; }
  if (isActive) {
    const next = list.filter(p => p.id !== id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    flushStores(); projects.switchTo(next.id, { reload: false });
  }
  projects.remove(id, { reload: false });
  if (isActive) reloadStores(); else emit('moodio:project-changed');
  return true;
}

// ===== 创作历史：所有项目里有内容的对话 =====
export interface HistoryEntry { projectId: string; projectTitle: string; chatId: string; title: string; at: number; }
function editChats(projectId: string, fn: (chats: Chat[]) => Chat[]) {
  const key = `${CHATS_BASE}::${projectId}`; const saved = readJSON<any>(key, null) || {};
  const chats = fn(Array.isArray(saved.chats) ? saved.chats : []);
  writeJSON(key, { ...saved, chats, active: chats.some(c => c.id === saved.active) ? saved.active : chats[0]?.id });
  emit('moodio:project-changed');
}

// 非当前项目的历史（当前项目直接用内存里的对话，能跟着流式更新）
export function otherProjectsHistory(): HistoryEntry[] {
  const active = projects.active().id; const out: HistoryEntry[] = [];
  for (const p of projects.list()) {
    if (p.id === active) continue;
    for (const c of readChats(p.id)) if (Array.isArray(c.messages) && c.messages.length) out.push({ projectId: p.id, projectTitle: p.title, chatId: String(c.id), title: String(c.title || p.title), at: Number(c.at) || p.updatedAt });
  }
  return out;
}
// 这个项目里有内容的对话数：只有一条时，删除这条历史 = 删除整个创作
export function chatCount(projectId: string): number {
  const chats = projectId === projects.active().id ? useChats.getState().chats : readChats(projectId);
  return chats.filter(c => Array.isArray(c.messages) && c.messages.length).length;
}
export function renameHistoryChat(projectId: string, chatId: string, title: string) {
  const next = String(title || '').trim(); if (!next) return;
  const p = projects.list().find(x => x.id === projectId); if (!p) return;
  const old = (projectId === projects.active().id ? useChats.getState().chats : readChats(projectId)).find(c => c.id === chatId)?.title;
  if (projectId === projects.active().id) useChats.getState().renameChat(chatId, next);
  else editChats(projectId, chats => chats.map(c => c.id === chatId ? { ...c, title: next } : c));
  if (p.title === NEW_PROJECT_TITLE || p.title === old) projects.rename(projectId, next);   // 项目名跟着对话标题
}
export function deleteHistoryChat(projectId: string, chatId: string) {
  if (projectId === projects.active().id) useChats.getState().deleteChat(chatId);
  else editChats(projectId, chats => chats.filter(c => c.id !== chatId));
}
