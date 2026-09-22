// ===== 导出片段到剪映：把成片的片段按顺序导出成一个文件夹，再用 videocut:// 唤起剪映，用户导入后拖到时间线 =====
// 为什么不直接写草稿：剪映专业版 macOS 11.4 不接受外部程序写进草稿目录的草稿——它会把文件夹收进草稿列表（名字、时长、封面都对），
// 但双击一律「草稿内容已损坏」。实测过完整字段 111.0.0、精简 164.0.0、目录名用 UUID、素材写绝对路径、自己往 root_meta_info.json
// 登记条目让三处 draft_id 一致、补 draft_cover.jpg、连同竞品草稿的 draft.extra / template.json.bak 一起复制，全部失败。
// 本机那份能打开的竞品草稿里带着 agent_adoption_ledger.db（表 agent_action_tracking_snapshots / adoption_records），
// 那是剪映自己内置 AI Agent 的库——说明它是剪映内部创建的，不是外部写盘，所以照抄它的文件没有意义。
// 于是退回到确定可用的做法：导出规整的片段文件夹 + 一份清单，用户在剪映里「导入」后按文件名顺序拖上时间线。
import { createStore, get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { getBlob, downloadBlob } from './storage';
import { readLedger } from './ledger';
import { findMedia } from './store';
import { projects } from './projects';
import type { MediaItem } from './types';
import { makeZip, safeFolderName } from './jianying-draft';

export const JIANYING_SCHEME = 'videocut://';

// ---- 片段来源：成片记着自己由哪几段拼成（compose.clips）；没有就用台账里按序号排好的片段；单独一条视频就导它自己 ----
export function collectClipIds(mediaId?: string): string[] {
  const target = mediaId ? findMedia(mediaId) : null;
  const composed = (target?.compose?.clips || []).filter(id => findMedia(id));
  if (composed.length) return composed;
  const ledger = readLedger();
  const fromLedger = (ledger?.clips || []).filter(c => c.mediaId && findMedia(c.mediaId)).sort((a, b) => a.no - b.no).map(c => c.mediaId!);
  if (target && target.model !== '本地合成' && !fromLedger.includes(target.id)) return [target.id];
  return fromLedger.length ? fromLedger : target ? [target.id] : [];
}
// 文件扩展名：文件名里有就用，否则按 mime 推
const MIME_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export function fileExt(m: Pick<MediaItem, 'name' | 'mime'>): string {
  const fromName = /\.([a-z0-9]{2,4})$/i.exec(m.name || '')?.[1]?.toLowerCase(); if (fromName) return fromName;
  return MIME_EXT[(m.mime || '').toLowerCase()] || 'mp4';
}
// 清单：给用户看的顺序表，也方便对着拖时间线
export function buildManifest(title: string, items: { file: string; name: string; seconds?: number }[]): string {
  const total = items.reduce((s, i) => s + (i.seconds || 0), 0);
  const lines = [`${title} · 片段清单`, '', '按下面的顺序拖到剪映时间线（文件名已经排好序）：', ''];
  items.forEach((it, i) => lines.push(`${String(i + 1).padStart(2, '0')}. ${it.file}${it.seconds ? `  ${it.seconds.toFixed(1)} 秒` : ''}   ← ${it.name}`));
  if (total) lines.push('', `合计 ${items.length} 段，约 ${Math.round(total)} 秒`);
  return lines.join('\n') + '\n';
}

// ---- 目录授权：记住用户选过的导出目录 ----
const settingsStore = createStore('moodio-settings', 'kv');
const DIR_KEY = 'jianying-export-dir';
type DirHandle = FileSystemDirectoryHandle & { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
export const canWriteDirectly = () => typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
export async function hasExportDir(): Promise<boolean> { return !!(await idbGet<DirHandle>(DIR_KEY, settingsStore).catch(() => null)); }
export async function forgetExportDir() { await idbDel(DIR_KEY, settingsStore).catch(() => {}); }
async function pickExportDir(): Promise<FileSystemDirectoryHandle> {
  let handle = await idbGet<DirHandle>(DIR_KEY, settingsStore).catch(() => null);
  if (handle) {
    const q = await handle.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt');
    if (q !== 'granted') { const r = await handle.requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied'); if (r !== 'granted') handle = null; }
  }
  if (!handle) { handle = await (window as any).showDirectoryPicker({ id: 'moodio-jianying', mode: 'readwrite', startIn: 'videos' }) as DirHandle; await idbSet(DIR_KEY, handle, settingsStore).catch(() => {}); }
  return handle;
}
async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(data); await w.close();
}

// ---- 主流程 ----
export interface ExportResult { mode: 'direct' | 'zip'; folder: string; clips: number; opened: boolean; }
export async function exportToJianying(mediaId?: string, onProgress?: (t: string) => void): Promise<ExportResult> {
  const ids = collectClipIds(mediaId); if (!ids.length) throw new Error('没有可导出的片段');
  const root = canWriteDirectly() ? await pickExportDir() : null;   // 选目录 / 询问权限必须紧跟用户的点击
  const title = projects.active().title || '创作'; const folder = safeFolderName(`${title} · Moodio 片段`);
  onProgress?.('读取片段…');
  const files: { file: string; name: string; seconds?: number; blob: Blob }[] = [];
  for (let i = 0; i < ids.length; i++) {
    const m = findMedia(ids[i])!; const blob = await getBlob(m.id); if (!blob) throw new Error(`「${m.name}」的文件不在本机媒体库里`);
    files.push({ file: `clip_${String(i + 1).padStart(2, '0')}.${fileExt(m)}`, name: m.name, seconds: m.duration, blob });
  }
  const manifest = buildManifest(title, files);
  if (root) {
    onProgress?.('写入片段…');
    let name = folder; for (let n = 2; ; n++) { try { await root.getDirectoryHandle(name); name = `${folder} ${n}`; } catch { break; } }
    const dir = await root.getDirectoryHandle(name, { create: true });
    for (let i = 0; i < files.length; i++) { onProgress?.(`复制片段 ${i + 1}/${files.length}…`); await writeFile(dir, files[i].file, files[i].blob); }
    await writeFile(dir, '片段清单.txt', manifest);
    let opened = false; try { window.location.href = JIANYING_SCHEME; opened = true; } catch { /* 没装剪映或浏览器拦了 */ }
    return { mode: 'direct', folder: name, clips: files.length, opened };
  }
  onProgress?.('打包片段…');
  const entries: { path: string; data: Uint8Array }[] = [{ path: `${folder}/片段清单.txt`, data: new TextEncoder().encode(manifest) }];
  for (const f of files) entries.push({ path: `${folder}/${f.file}`, data: new Uint8Array(await f.blob.arrayBuffer()) });
  downloadBlob(`${folder}.zip`, makeZip(entries));
  return { mode: 'zip', folder, clips: files.length, opened: false };
}
