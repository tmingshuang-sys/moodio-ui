// ===== 本地合成成片：把若干段视频按顺序拼成一条，可加配乐与字幕 =====
// 首选 WebCodecs + mp4-muxer 直接编出 H.264 + AAC 的 MP4（Chrome / Edge）；不支持 WebCodecs 时退回 MediaRecorder 录成 WebM。
// 画面靠实时播放逐帧画到 canvas（字幕也画在这一步），声音用 OfflineAudioContext 把各段原声与配乐离线混好再编码，所以耗时约等于成片总时长。
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { MediaItem } from './types';
import { uid } from './types';
import { useFiles } from './store';
import { mediaUrl, getBlob, putBlob, cacheUrl } from './storage';

export interface Subtitle { start: number; end: number; text: string; }
export interface ComposeOptions { name?: string; onProgress?: (text: string) => void; signal?: AbortSignal; musicId?: string; musicVolume?: number; subtitles?: Subtitle[]; format?: 'mp4' | 'webm'; }

export function mp4Supported(): boolean { return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'; }
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
const SAMPLE_RATE = 48000;

// 字幕：按画面宽度折行，优先在标点或空格处断，最多两行，多出的部分舍弃
const BREAK_RE = /[，。！？、；：,.!?;:]/;
export function wrapSubtitle(text: string, maxChars: number): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim(); if (!clean) return [];
  const max = Math.max(4, Math.floor(maxChars)); const lines: string[] = []; let rest = clean;
  while (rest.length > max && lines.length < 2) {
    let cut = -1;
    for (let i = Math.min(max, rest.length - 1); i >= Math.floor(max / 2); i--) { const ch = rest[i]; if (ch === ' ') { cut = i; break; } if (BREAK_RE.test(ch)) { cut = i + 1; break; } }
    if (cut <= 0) cut = max;
    lines.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest && lines.length < 2) lines.push(rest);
  return lines;
}
export function activeSubtitle(subs: Subtitle[] | undefined, t: number): Subtitle | null {
  if (!subs?.length) return null;
  return subs.find(s => t >= s.start && t < s.end) || null;
}
function normalizeSubtitles(subs?: Subtitle[]): Subtitle[] {
  return (Array.isArray(subs) ? subs : []).map(s => ({ start: Math.max(0, Number(s?.start) || 0), end: Number(s?.end) || 0, text: String(s?.text || '').slice(0, 120) })).filter(s => s.text && s.end > s.start).sort((a, b) => a.start - b.start);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video'); v.src = url; v.preload = 'auto'; v.playsInline = true; v.muted = true; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve(v); v.onerror = () => reject(new Error('视频无法解码')); v.load();
  });
}
// WebM 里 duration 可能是 Infinity：跳到很后面再读一次
async function realDuration(v: HTMLVideoElement): Promise<number> {
  if (isFinite(v.duration) && v.duration > 0) return v.duration;
  return new Promise(resolve => { const onT = () => { v.ontimeupdate = null; v.currentTime = 0; resolve(isFinite(v.duration) ? v.duration : 0); }; v.ontimeupdate = onT; v.currentTime = 1e6; });
}

function drawFrame(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, v: HTMLVideoElement, subtitle: Subtitle | null) {
  const r = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight); const w = v.videoWidth * r, h = v.videoHeight * r;
  g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height); g.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  if (!subtitle) return;
  const size = Math.round(canvas.height / 20); const lines = wrapSubtitle(subtitle.text, Math.floor(canvas.width * 0.86 / (size * 0.95)));
  g.font = `600 ${size}px "PingFang SC", "Noto Sans CJK SC", "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 7); g.strokeStyle = 'rgba(0, 0, 0, .85)'; g.fillStyle = '#fff';
  g.shadowColor = 'rgba(0, 0, 0, .5)'; g.shadowBlur = size / 4;
  lines.forEach((line, i) => { const y = canvas.height * 0.9 - (lines.length - 1 - i) * size * 1.3; g.strokeText(line, canvas.width / 2, y); g.fillText(line, canvas.width / 2, y); });
  g.shadowBlur = 0;
}

// 离线混音：各段原声按顺序排开，配乐循环铺底、结尾 2 秒淡出
async function mixAudio(clips: { blob: Blob; duration: number }[], music: Blob | null, volume: number, total: number): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * SAMPLE_RATE)), SAMPLE_RATE);
  let t = 0;
  for (const c of clips) {
    try { const buf = await off.decodeAudioData(await c.blob.arrayBuffer()); const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(t); src.stop(t + c.duration); } catch { /* 没有音轨就静音 */ }
    t += c.duration;
  }
  if (music) {
    try {
      const buf = await off.decodeAudioData(await music.arrayBuffer()); const src = off.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = off.createGain(); gain.gain.setValueAtTime(volume, 0); gain.gain.setValueAtTime(volume, Math.max(0, total - 2)); gain.gain.linearRampToValueAtTime(0, total);
      src.connect(gain).connect(off.destination); src.start(0); src.stop(total);
    } catch { /* 配乐解码失败就不放 */ }
  }
  return off.startRendering();
}

async function pickVideoCodec(width: number, height: number): Promise<VideoEncoderConfig> {
  for (const codec of ['avc1.4d0028', 'avc1.42001f', 'avc1.640028']) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: 6_000_000, framerate: 30, avc: { format: 'avc' } } as VideoEncoderConfig;
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch { /* next */ }
  }
  throw new Error('当前浏览器没有可用的 H.264 编码器');
}
async function pickAudioCodec(): Promise<{ config: AudioEncoderConfig; mux: 'aac' | 'opus' } | null> {
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']] as const) {
    const config: AudioEncoderConfig = { codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 128_000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux }; } catch { /* next */ }
  }
  return null;
}

async function saveResult(blob: Blob, name: string, ext: string, width: number, height: number, duration: number): Promise<MediaItem> {
  const id = uid('m'); await putBlob(id, blob); cacheUrl(id, blob);
  const meta: MediaItem = { id, name: `${name.replace(/\.(webm|mp4)$/i, '')}.${ext}`, kind: 'video', mime: blob.type, size: blob.size, group: '其他', createdAt: Date.now(), by: 'agent', width, height, model: '本地合成', duration: Math.round(duration * 10) / 10 };
  useFiles.getState().addMedia(meta);
  return meta;
}

export async function composeVideos(ids: string[], opts: ComposeOptions = {}): Promise<MediaItem> {
  const { name = '成片', onProgress, signal } = opts;
  if (!ids.length) throw new Error('没有可合成的片段');
  onProgress?.('准备片段…');
  const videos: HTMLVideoElement[] = []; const blobs: Blob[] = [];
  for (const id of ids) { const url = await mediaUrl(id); const blob = await getBlob(id); if (!url || !blob) throw new Error(`片段 ${id} 不在本机媒体库里`); videos.push(await loadVideo(url)); blobs.push(blob); }
  const durations: number[] = []; for (const v of videos) durations.push(await realDuration(v));
  const total = durations.reduce((s, d) => s + d, 0); if (!(total > 0)) throw new Error('片段时长为 0');
  const first = videos[0]; const scale = Math.min(1, 1280 / Math.max(1, first.videoWidth));
  const canvas = document.createElement('canvas'); canvas.width = even(first.videoWidth * scale); canvas.height = even(first.videoHeight * scale);
  const g = canvas.getContext('2d'); if (!g) throw new Error('无法创建画布');
  const subs = normalizeSubtitles(opts.subtitles);
  const music = opts.musicId ? (await getBlob(opts.musicId)) || null : null;
  const volume = Math.max(0, Math.min(1, Number(opts.musicVolume ?? 0.3)));
  const useMp4 = (opts.format || 'mp4') === 'mp4' && mp4Supported();
  let stop = false; const onAbort = () => { stop = true; }; signal?.addEventListener('abort', onAbort);
  try {
    if (useMp4) return await composeMp4({ videos, blobs, durations, total, canvas, g, subs, music, volume, name, onProgress, isStopped: () => stop });
    return await composeWebm({ videos, blobs, durations, total, canvas, g, subs, music, volume, name, onProgress, isStopped: () => stop });
  } finally {
    signal?.removeEventListener('abort', onAbort);
    videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
  }
}

interface Job { videos: HTMLVideoElement[]; blobs: Blob[]; durations: number[]; total: number; canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; subs: Subtitle[]; music: Blob | null; volume: number; name: string; onProgress?: (t: string) => void; isStopped: () => boolean; }

// 逐段实时播放，每一帧回调里画到 canvas 并交给 onFrame
async function playThrough(job: Job, onFrame: (globalTime: number) => void) {
  const { videos, durations, canvas, g, subs, onProgress, isStopped, total } = job;
  let elapsed = 0;
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i]; if (isStopped()) break;
    v.currentTime = 0; await v.play();
    await new Promise<void>(resolve => {
      const tick = (now?: number, meta?: any) => {
        if (isStopped() || v.ended) { resolve(); return; }
        const local = meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : v.currentTime;
        const gt = elapsed + Math.min(local, durations[i]);
        drawFrame(g, canvas, v, activeSubtitle(subs, gt)); onFrame(gt);
        onProgress?.(`合成中 · 第 ${i + 1}/${videos.length} 段 · ${Math.round(gt)}/${Math.round(total)}s`);
        schedule();
      };
      const schedule = () => { if ('requestVideoFrameCallback' in v) (v as any).requestVideoFrameCallback(tick); else requestAnimationFrame(() => tick()); };
      v.onended = () => resolve(); schedule();
    });
    v.pause(); elapsed += durations[i];
  }
  if (isStopped()) throw new DOMException('已停止', 'AbortError');
}

async function composeMp4(job: Job): Promise<MediaItem> {
  const { canvas, blobs, durations, total, music, volume, name, onProgress } = job;
  const vconf = await pickVideoCodec(canvas.width, canvas.height); const aconf = await pickAudioCodec();
  // firstTimestampBehavior 用 offset：mp4-muxer 默认要求第一帧时间戳必须是 0，否则在编码器回调里抛错、帧被悄悄丢掉
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: canvas.width, height: canvas.height }, audio: aconf ? { codec: aconf.mux, sampleRate: SAMPLE_RATE, numberOfChannels: 2 } : undefined, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
  let encodeError: any = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => { try { muxer.addVideoChunk(chunk, meta); } catch (e) { encodeError = e; } }, error: e => { encodeError = e; } });
  venc.configure(vconf);
  let frames = 0, lastTs = -1000;   // 第一帧从 0 开始
  await playThrough(job, gt => {
    if (encodeError) return;
    const ts = Math.max(lastTs + 1000, Math.round(gt * 1e6)); lastTs = ts;
    const frame = new VideoFrame(canvas, { timestamp: ts });
    try { venc.encode(frame, { keyFrame: frames % 60 === 0 }); } finally { frame.close(); }
    frames++;
  });
  await venc.flush(); venc.close();
  if (encodeError) throw new Error('视频编码失败：' + (encodeError?.message || encodeError));
  if (!frames) throw new Error('没有录到画面');
  if (aconf) {
    onProgress?.('混音与编码音轨…');
    const mixed = await mixAudio(blobs.map((blob, i) => ({ blob, duration: durations[i] })), music, volume, total);
    const aenc = new AudioEncoder({ output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { encodeError = e; } }, error: e => { encodeError = e; } });
    aenc.configure(aconf.config);
    const step = 4096; const ch0 = mixed.getChannelData(0), ch1 = mixed.numberOfChannels > 1 ? mixed.getChannelData(1) : ch0;
    for (let off = 0; off < mixed.length; off += step) {
      const n = Math.min(step, mixed.length - off); const data = new Float32Array(n * 2);
      data.set(ch0.subarray(off, off + n), 0); data.set(ch1.subarray(off, off + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(off / SAMPLE_RATE * 1e6), data });
      aenc.encode(ad); ad.close();
    }
    await aenc.flush(); aenc.close();
    if (encodeError) throw new Error('音频编码失败：' + (encodeError?.message || encodeError));
  }
  onProgress?.('写入文件…');
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  return saveResult(blob, name, 'mp4', canvas.width, canvas.height, total);
}

// 退路：MediaRecorder 录 WebM（画面同样逐帧画 canvas，声音用实时 AudioContext 混）
async function composeWebm(job: Job): Promise<MediaItem> {
  const { videos, canvas, music, volume, name, onProgress, total } = job;
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持本地合成');
  const audio = new AudioContext(); const dest = audio.createMediaStreamDestination();
  videos.forEach(v => { v.muted = false; try { audio.createMediaElementSource(v).connect(dest); } catch { /* ignore */ } });
  if (music) { try { const buf = await audio.decodeAudioData(await music.arrayBuffer()); const src = audio.createBufferSource(); src.buffer = buf; src.loop = true; const gain = audio.createGain(); gain.gain.value = volume; src.connect(gain).connect(dest); src.start(); setTimeout(() => { try { src.stop(); } catch { /* ignore */ } }, total * 1000); } catch { /* ignore */ } }
  const stream = canvas.captureStream(30); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>(resolve => { rec.onstop = () => resolve(); });
  try { await audio.resume(); rec.start(1000); await playThrough(job, () => {}); }
  finally { if (rec.state !== 'inactive') rec.stop(); await stopped; await audio.close().catch(() => {}); }
  onProgress?.('写入文件…');
  const blob = new Blob(chunks, { type: mime || 'video/webm' }); if (!blob.size) throw new Error('没有录到画面');
  return saveResult(blob, name, 'webm', canvas.width, canvas.height, total);
}
