// ===== 素材库：所有创作（项目）里生成 / 上传的图片与视频，一处查看 =====
// 当前项目的媒体直接用内存里的 useFiles（能跟着生成实时更新），其他项目的从 localStorage 读；改名 / 删除也按项目分别落到对应的键。
import type { MediaItem, TrashEntry } from './types';
import { uid } from './types';
import { projects } from './projects';
import { useFiles, useNav } from './store';
import { readJSON, writeJSON } from './storage';
import { switchProject } from './session';

export interface LibraryItem extends MediaItem { projectId: string; projectTitle: string; }
const FILES_BASE = 'moodio-files-v1';
const emit = () => window.dispatchEvent(new CustomEvent('moodio:library-changed'));

export function allMedia(): LibraryItem[] {
  const active = projects.active();
  const out: LibraryItem[] = useFiles.getState().media.map(m => ({ ...m, projectId: active.id, projectTitle: active.title }));
  for (const p of projects.list()) {
    if (p.id === active.id) continue;
    const saved = readJSON<any>(`${FILES_BASE}::${p.id}`, null);
    for (const m of (Array.isArray(saved?.media) ? saved.media : []) as MediaItem[]) out.push({ ...m, projectId: p.id, projectTitle: p.title });
  }
  return out;
}

function editFiles(projectId: string, fn: (saved: any) => void) {
  const key = `${FILES_BASE}::${projectId}`; const saved = readJSON<any>(key, null); if (!saved) return;
  fn(saved); writeJSON(key, saved); emit();
}
const isActive = (projectId: string) => projectId === projects.active().id;

export function renameLibraryMedia(projectId: string, id: string, name: string) {
  const next = String(name || '').trim(); if (!next) return;
  if (isActive(projectId)) { useFiles.getState().updateMedia(id, { name: next }); return; }
  editFiles(projectId, s => { s.media = (s.media || []).map((m: MediaItem) => m.id === id ? { ...m, name: next } : m); });
}
// 删除进对应项目的回收站（7 天），返回回收站条目以便「撤销」
export function deleteLibraryMedia(projectId: string, id: string): TrashEntry | null {
  if (isActive(projectId)) return useFiles.getState().removeMedia(id);
  let entry: TrashEntry | null = null;
  editFiles(projectId, s => {
    const media: MediaItem[] = s.media || []; const m = media.find(x => x.id === id); if (!m) return;
    entry = { trashId: uid('t'), deletedAt: Date.now(), media: m };
    s.media = media.filter(x => x.id !== id); s.trash = [entry, ...(s.trash || [])].slice(0, 60);
    if (s.ui?.openId === id) s.ui.openId = null;
  });
  return entry;
}
export function restoreLibraryMedia(projectId: string, trashId: string) {
  if (isActive(projectId)) { useFiles.getState().restoreTrash(trashId); return; }
  editFiles(projectId, s => {
    const e = (s.trash || []).find((x: TrashEntry) => x.trashId === trashId); if (!e?.media) return;
    s.trash = s.trash.filter((x: TrashEntry) => x !== e); s.media = [e.media, ...(s.media || [])];
  });
}
// 切到这个媒体所在的创作并在工作区打开它
export function openInCreation(projectId: string, id: string): boolean {
  if (!isActive(projectId) && !switchProject(projectId)) return false;
  useFiles.getState().openInPane(id); useNav.getState().go('chat'); return true;
}
