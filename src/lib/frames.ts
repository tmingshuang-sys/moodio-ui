// ===== 视频截帧：取某一段视频的首帧 / 末帧 / 某秒的画面存成关键帧图（本地画布，不计费），供片段之间的首尾帧接续 =====
import type { MediaItem } from './types';
import { uid } from './types';
import { useFiles, findMedia } from './store';
import { mediaUrl, putBlob, cacheUrl } from './storage';
import { sanitizeName } from './markdown';

function loadMeta(v: HTMLVideoElement): Promise<void> {
  return new Promise((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('视频无法解码')); v.load(); });
}
// MediaRecorder 录的 WebM 时长是 Infinity：先跳到很后面再读一次
async function realDuration(v: HTMLVideoElement): Promise<number> {
  if (isFinite(v.duration) && v.duration > 0) return v.duration;
  return new Promise(resolve => { v.ontimeupdate = () => { v.ontimeupdate = null; resolve(isFinite(v.duration) ? v.duration : 0); }; v.currentTime = 1e6; });
}
function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((res, rej) => { v.onseeked = () => res(); v.onerror = () => rej(new Error('视频无法定位到该帧')); v.currentTime = t; });
}

export async function captureFrame(videoId: string, at: 'first' | 'last' | number = 'last', name?: string): Promise<MediaItem> {
  const src = findMedia(videoId); if (!src) throw new Error(`找不到 id 为「${videoId}」的视频`);
  if (src.kind !== 'video') throw new Error(`「${src.name}」不是视频，不能截帧`);
  const url = await mediaUrl(videoId); if (!url) throw new Error(`「${src.name}」的文件不在本机媒体库里`);
  const v = document.createElement('video'); v.src = url; v.muted = true; v.playsInline = true; v.preload = 'auto';
  await loadMeta(v);
  const duration = await realDuration(v);
  const t = at === 'first' ? 0 : at === 'last' ? Math.max(0, duration - 0.1) : Math.min(Math.max(0, at), Math.max(0, duration - 0.05));
  await seek(v, t);
  const scale = Math.min(1, 1920 / Math.max(1, v.videoWidth));
  const w = Math.max(2, Math.round(v.videoWidth * scale)), h = Math.max(2, Math.round(v.videoHeight * scale));
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d')!.drawImage(v, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('截帧失败')), 'image/jpeg', 0.92));
  const id = uid('m'); await putBlob(id, blob); cacheUrl(id, blob);
  const label = at === 'first' ? '首帧' : at === 'last' ? '末帧' : `${Math.round(Number(at))}秒`;
  const base = sanitizeName(name || `${src.name.replace(/\.[a-z0-9]+$/i, '')}-${label}`);
  const meta: MediaItem = { id, name: `${base}.jpg`, kind: 'image', mime: 'image/jpeg', size: blob.size, group: '关键帧', createdAt: Date.now(), by: 'agent', width: w, height: h, model: '截帧' };
  useFiles.getState().addMedia(meta);
  return meta;
}
