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
import { makeZip, safeFolderName } from './jianying-draft';
import { buildFcpxml, buildEdl, buildSrt, cleanPath, isAbsolutePath, buildManifest, fileExt } from './nle';

export const JIANYING_SCHEME = 'videocut://';
const BASE_PATH_KEY = 'moodio-export-base-path';   // 片段文件夹的父目录绝对路径，用户粘贴一次（FCPXML 的媒体引用必须是绝对路径）
export const basePath = () => cleanPath(localStorage.getItem(BASE_PATH_KEY) || '');
export const setBasePath = (p: string) => { const c = cleanPath(p); if (c) localStorage.setItem(BASE_PATH_KEY, c); else localStorage.removeItem(BASE_PATH_KEY); };
export const basePathOk = (p: string) => isAbsolutePath(p);

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
// 片段的真实时长与宽高：媒体项里没记就用 video 元素现场读（FCPXML 的时间线长度全靠它）
function probeVideo(blob: Blob): Promise<{ seconds: number; width: number; height: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = url;
    const done = (d: number) => { URL.revokeObjectURL(url); resolve({ seconds: d, width: v.videoWidth || 0, height: v.videoHeight || 0 }); };
    v.onloadedmetadata = () => { if (isFinite(v.duration) && v.duration > 0) done(v.duration); else { v.ontimeupdate = () => { v.ontimeupdate = null; done(isFinite(v.duration) ? v.duration : 0); }; v.currentTime = 1e6; } };
    v.onerror = () => { URL.revokeObjectURL(url); resolve({ seconds: 0, width: 0, height: 0 }); };
  });
}
// ---- 目录授权：记住用户选过的导出目录 ----
const settingsStore = createStore('moodio-settings', 'kv');
const DIR_KEY = 'jianying-export-dir';
type DirHandle = FileSystemDirectoryHandle & { queryPermission?: (o: { mode: string }) => Promise<string>; requestPermission?: (o: { mode: string }) => Promise<string> };
export const canWriteDirectly = () => typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
export async function hasExportDir(): Promise<boolean> { return !!(await idbGet<DirHandle>(DIR_KEY, settingsStore).catch(() => null)); }
export async function rememberExportDir(handle: FileSystemDirectoryHandle) { await idbSet(DIR_KEY, handle, settingsStore).catch(() => {}); }
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
export interface ExportResult { mode: 'direct' | 'zip'; folder: string; clips: number; opened: boolean; project: boolean; }   // project：是否附带了可一键导入的 FCPXML 工程
export async function exportToJianying(mediaId?: string, onProgress?: (t: string) => void): Promise<ExportResult> {
  const ids = collectClipIds(mediaId); if (!ids.length) throw new Error('没有可导出的片段');
  const root = canWriteDirectly() ? await pickExportDir() : null;   // 选目录 / 询问权限必须紧跟用户的点击
  const title = projects.active().title || '创作'; const folder = safeFolderName(`${title} · Moodio 片段`);
  onProgress?.('读取片段…');
  const files: { file: string; name: string; seconds?: number; width?: number; height?: number; blob: Blob }[] = [];
  for (let i = 0; i < ids.length; i++) {
    const m = findMedia(ids[i])!; const blob = await getBlob(m.id); if (!blob) throw new Error(`「${m.name}」的文件不在本机媒体库里`);
    let seconds = m.duration || 0, width = m.width || 0, height = m.height || 0;
    if (!seconds || !width) { const p = await probeVideo(blob); seconds = seconds || p.seconds; width = width || p.width; height = height || p.height; }
    files.push({ file: `clip_${String(i + 1).padStart(2, '0')}.${fileExt(m)}`, name: m.name, seconds, width, height, blob });
  }
  // 配乐 / 配音与字幕：成片记着它们，一并放进导出目录（FCPXML 里不写音频，否则达芬奇会打乱音轨分配）
  const extras: { file: string; blob: Blob }[] = [];
  const recipe = mediaId ? findMedia(mediaId)?.compose : undefined;
  const addAudio = async (id: string, tag: string) => {
    const m = findMedia(id); if (!m) return; const blob = await getBlob(m.id); if (!blob) return;
    extras.push({ file: `${tag}.${(/\.([a-z0-9]{2,4})$/i.exec(m.name)?.[1] || 'mp3').toLowerCase()}`, blob });
  };
  if (recipe?.musicId) await addAudio(recipe.musicId, '配乐');
  for (let i = 0; i < (recipe?.voices || []).length; i++) await addAudio(recipe!.voices![i].id, `配音_${String(i + 1).padStart(2, '0')}`);
  const srt = buildSrt(recipe?.subtitles || []);
  const manifest = buildManifest(title, files);
  const nleClips = files.map(f => ({ file: f.file, name: f.name, seconds: f.seconds || 0, width: f.width, height: f.height }));
  const edl = buildEdl({ title, clips: nleClips });
  if (root) {
    onProgress?.('写入片段…');
    let name = folder; for (let n = 2; ; n++) { try { await root.getDirectoryHandle(name); name = `${folder} ${n}`; } catch { break; } }
    const dir = await root.getDirectoryHandle(name, { create: true });
    for (let i = 0; i < files.length; i++) { onProgress?.(`复制片段 ${i + 1}/${files.length}…`); await writeFile(dir, files[i].file, files[i].blob); }
    await writeFile(dir, '片段清单.txt', manifest);
    await writeFile(dir, `${title}.edl`, edl);
    for (const e of extras) await writeFile(dir, e.file, e.blob);
    if (srt) await writeFile(dir, `${title}.srt`, srt);
    // 知道绝对路径才能生成 FCPXML：媒体引用必须是绝对的 file:// URL
    const base = basePath(); let project = false;
    if (base) { await writeFile(dir, `${title}.fcpxml`, buildFcpxml({ title, clips: nleClips, dirPath: `${base}/${name}` })); project = true; }
    // 有工程文件说明走达芬奇 / Final Cut，不再弹剪映（达芬奇没有 URL scheme，网页唤不起，只能提示位置）
    let opened = false;
    if (!project) { try { window.location.href = JIANYING_SCHEME; opened = true; } catch { /* 没装剪映或浏览器拦了 */ } }
    return { mode: 'direct', folder: name, clips: files.length, opened, project };
  }
  onProgress?.('打包片段…');
  const enc = new TextEncoder();
  const entries: { path: string; data: Uint8Array }[] = [{ path: `${folder}/片段清单.txt`, data: enc.encode(manifest) }, { path: `${folder}/${title}.edl`, data: enc.encode(edl) }];
  if (srt) entries.push({ path: `${folder}/${title}.srt`, data: enc.encode(srt) });
  for (const e of extras) entries.push({ path: `${folder}/${e.file}`, data: new Uint8Array(await e.blob.arrayBuffer()) });
  const base = basePath();
  if (base) entries.push({ path: `${folder}/${title}.fcpxml`, data: enc.encode(buildFcpxml({ title, clips: nleClips, dirPath: `${base}/${folder}` })) });
  for (const f of files) entries.push({ path: `${folder}/${f.file}`, data: new Uint8Array(await f.blob.arrayBuffer()) });
  downloadBlob(`${folder}.zip`, makeZip(entries));
  return { mode: 'zip', folder, clips: files.length, opened: false, project: !!base };
}
