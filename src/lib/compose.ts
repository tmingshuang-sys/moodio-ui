// ===== 本地合成成片：把若干段视频按顺序拼成一条（浏览器内 canvas + MediaRecorder，不依赖 ffmpeg）=====
// 实时播放每段并把画面画到 canvas、声音混进 AudioContext，录成 WebM 存进媒体库。耗时约等于成片总时长。
import type { MediaItem } from './types';
import { uid } from './types';
import { useFiles } from './store';
import { mediaUrl, putBlob, cacheUrl } from './storage';

export interface ComposeOptions { name?: string; onProgress?: (text: string) => void; signal?: AbortSignal; }

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'); v.src = url; v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve(v); v.onerror = () => reject(new Error('视频无法解码')); v.load();
  });
}
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export async function composeVideos(ids: string[], { name = '成片', onProgress, signal }: ComposeOptions = {}): Promise<MediaItem> {
  if (!ids.length) throw new Error('没有可合成的片段');
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持本地合成');
  onProgress?.('准备片段…');
  const videos: HTMLVideoElement[] = [];
  for (const id of ids) { const url = await mediaUrl(id); if (!url) throw new Error(`片段 ${id} 不在本机媒体库里`); videos.push(await loadVideo(url)); }
  const first = videos[0]; const scale = Math.min(1, 1280 / Math.max(1, first.videoWidth));
  const canvas = document.createElement('canvas'); canvas.width = even(first.videoWidth * scale); canvas.height = even(first.videoHeight * scale);
  const g = canvas.getContext('2d'); if (!g) throw new Error('无法创建画布');
  const audio = new AudioContext(); const dest = audio.createMediaStreamDestination();
  const sources = videos.map(v => { try { const s = audio.createMediaElementSource(v); s.connect(dest); return s; } catch { return null; } });
  const stream = canvas.captureStream(30); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>(resolve => { rec.onstop = () => resolve(); });
  const total = videos.reduce((s, v) => s + (isFinite(v.duration) ? v.duration : 0), 0);
  let stop = false; const onAbort = () => { stop = true; };
  signal?.addEventListener('abort', onAbort);
  try {
    await audio.resume(); rec.start(1000);
    let elapsed = 0;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i]; if (stop) break;
      v.currentTime = 0; await v.play();
      const draw = () => {
        const r = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight); const w = v.videoWidth * r, h = v.videoHeight * r;
        g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      };
      await new Promise<void>(resolve => {
        const tick = () => { if (stop || v.ended) { resolve(); return; } draw(); onProgress?.(`合成中 · 第 ${i + 1}/${videos.length} 段 · ${Math.round(elapsed + v.currentTime)}/${Math.round(total)}s`); requestAnimationFrame(tick); };
        v.onended = () => resolve(); tick();
      });
      draw(); elapsed += isFinite(v.duration) ? v.duration : 0; v.pause();
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    if (rec.state !== 'inactive') rec.stop(); await stopped;
    sources.forEach(s => s?.disconnect()); await audio.close().catch(() => {}); videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
  }
  if (stop) throw new DOMException('已停止', 'AbortError');
  onProgress?.('写入媒体库…');
  const blob = new Blob(chunks, { type: mime || 'video/webm' }); if (!blob.size) throw new Error('没有录到画面');
  const id = uid('m'); await putBlob(id, blob); cacheUrl(id, blob);
  const meta: MediaItem = { id, name: `${name.replace(/\.(webm|mp4)$/i, '')}.webm`, kind: 'video', mime: blob.type, size: blob.size, group: '其他', createdAt: Date.now(), by: 'agent', width: canvas.width, height: canvas.height, model: '本地合成' };
  useFiles.getState().addMedia(meta);
  return meta;
}
