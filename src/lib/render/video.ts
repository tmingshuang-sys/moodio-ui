// ===== 用代码渲染成片：画面方案 + 逐句配音 → 一条 MP4 =====
// 不经过任何视频模型：画面由 paint.ts 逐帧画出，声音由离线混音把逐句配音按时间轴摆好，两路一起交给 mediabunny 编码。
// 时间轴来自 beat.seconds（配音阶段写回的真实音频时长），所以声画天生对齐，耗时只取决于 CPU，不按次计费。
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, canEncodeAudio, getFirstEncodableAudioCodec, getFirstEncodableVideoCodec } from 'mediabunny';
import type { AudioCodec, VideoCodec } from 'mediabunny';
import type { MediaItem } from '../types';
import { uid } from '../types';
import { useFiles } from '../store';
import { getBlob, putBlob, cacheUrl } from '../storage';
import { subtitlesOf, timelineOf, type SceneSpec } from './spec';
import { layoutFor, themeFor } from './theme';
import { drawFrame, type Stage } from './paint';

const SAMPLE_RATE = 48000;
export interface RenderOptions { name?: string; onProgress?: (text: string, ratio: number) => void; signal?: AbortSignal; group?: string; }
export function renderSupported(): boolean { return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'; }

// 媒体库里的图片 → ImageBitmap（画 image 模板用）
async function loadImages(spec: SceneSpec): Promise<Map<string, ImageBitmap>> {
  const out = new Map<string, ImageBitmap>();
  const ids = Array.from(new Set(spec.beats.map(b => b.mediaId).filter(Boolean) as string[]));
  for (const id of ids) {
    const blob = await getBlob(id);
    if (!blob) continue;
    try { out.set(id, await createImageBitmap(blob)); } catch { /* 解码不了就按缺图处理 */ }
  }
  return out;
}

// 混音：每句配音放在它那一段的起点，配乐铺底并在结尾两秒淡出
async function mixAudio(spec: SceneSpec, total: number): Promise<AudioBuffer | null> {
  const tl = timelineOf(spec);
  const voices = tl.slots.filter(s => s.beat.voiceId).map(s => ({ id: s.beat.voiceId!, start: s.start }));
  const musicBlob = spec.music ? await getBlob(spec.music) : null;
  if (!voices.length && !musicBlob) return null;
  const off = new OfflineAudioContext(2, Math.max(1, Math.ceil(total * SAMPLE_RATE)), SAMPLE_RATE);
  for (const v of voices) {
    const blob = await getBlob(v.id); if (!blob) continue;
    try {
      const buf = await off.decodeAudioData(await blob.arrayBuffer());
      const src = off.createBufferSource(); src.buffer = buf;
      src.connect(off.destination); src.start(v.start); src.stop(Math.min(total, v.start + buf.duration));
    } catch { /* 这一句解码失败就当没有配音 */ }
  }
  if (musicBlob) {
    try {
      const buf = await off.decodeAudioData(await musicBlob.arrayBuffer());
      const src = off.createBufferSource(); src.buffer = buf; src.loop = true;
      const gain = off.createGain(); const vol = spec.musicVolume ?? (voices.length ? 0.14 : 0.5);   // 有口播时配乐压到 0.14，不然盖住人声
      gain.gain.setValueAtTime(vol, 0); gain.gain.setValueAtTime(vol, Math.max(0, total - 2)); gain.gain.linearRampToValueAtTime(0, total);
      src.connect(gain).connect(off.destination); src.start(0); src.stop(total);
    } catch { /* 配乐解码失败就不放 */ }
  }
  return off.startRendering();
}

const VIDEO_CODECS: VideoCodec[] = ['avc', 'vp9', 'av1'];
const AUDIO_CODECS: AudioCodec[] = ['aac', 'opus'];

export async function renderScene(spec: SceneSpec, opts: RenderOptions = {}): Promise<MediaItem> {
  if (!renderSupported()) throw new Error('当前浏览器不支持 WebCodecs，无法用代码渲染视频（Chrome / Edge 可用）');
  const tl = timelineOf(spec);
  if (!tl.slots.length) throw new Error('画面方案里没有任何 beat');
  const { onProgress, signal } = opts;
  const stop = () => { if (signal?.aborted) throw new DOMException('已停止', 'AbortError'); };
  const layout = layoutFor(spec.ratio);
  onProgress?.('准备素材…', 0);

  const images = await loadImages(spec); stop();
  const canvas = document.createElement('canvas'); canvas.width = layout.w; canvas.height = layout.h;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('拿不到 canvas 画笔');
  const theme = themeFor(spec.theme, spec.palette);
  const stage: Stage = { ctx, spec, tl, layout, theme, measure: (s, size) => { ctx.font = `700 ${size}px ${theme.display}`; return ctx.measureText(s).width; }, images };

  const videoCodec = await getFirstEncodableVideoCodec(VIDEO_CODECS, { width: layout.w, height: layout.h });
  if (!videoCodec) throw new Error('当前浏览器没有可用的视频编码器');
  const audioCodec = await getFirstEncodableAudioCodec(AUDIO_CODECS, { numberOfChannels: 2, sampleRate: SAMPLE_RATE });
  const mp4 = videoCodec === 'avc' || videoCodec === 'av1';
  const format = mp4 ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat();
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: spec.fps });

  onProgress?.('混音…', 0.02);
  const mixed = audioCodec ? await mixAudio(spec, tl.total) : null; stop();
  let audioSource: AudioBufferSource | null = null;
  if (mixed && audioCodec && (await canEncodeAudio(audioCodec, { numberOfChannels: mixed.numberOfChannels, sampleRate: mixed.sampleRate }))) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  const frames = Math.max(1, Math.round(tl.total * spec.fps));
  const step = 1 / spec.fps;
  try {
    if (audioSource && mixed) await audioSource.add(mixed);
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
      const t = i * step;
      drawFrame(stage, t, i);
      await videoSource.add(t, step);
      if (i % Math.max(1, Math.round(spec.fps / 2)) === 0) {
        const ratio = 0.05 + 0.9 * (i / frames);
        onProgress?.(`渲染第 ${i + 1}/${frames} 帧 · ${Math.round(t)}/${Math.round(tl.total)}s`, ratio);
        await new Promise(r => setTimeout(r, 0));     // 让出主线程，界面不卡死
      }
    }
    audioSource?.close();
    videoSource.close();
    onProgress?.('写入文件…', 0.97);
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  const buffer = target.buffer;
  if (!buffer) throw new Error('编码没有产出数据');
  const ext = mp4 ? 'mp4' : 'webm';
  const blob = new Blob([buffer], { type: mp4 ? 'video/mp4' : 'video/webm' });
  const id = uid('m');
  await putBlob(id, blob); cacheUrl(id, blob);
  const base = (opts.name || spec.title || '画面').replace(/\.(mp4|webm)$/i, '');
  const item: MediaItem = {
    id, name: `${base}.${ext}`, kind: 'video', mime: blob.type, size: blob.size,
    group: opts.group || '成片', createdAt: Date.now(), by: 'agent',
    width: layout.w, height: layout.h, model: '代码渲染',
    duration: Math.round(tl.total * 10) / 10,
    compose: { clips: [], subtitles: spec.subtitle ? subtitlesOf(spec, tl) : undefined, musicId: spec.music, musicVolume: spec.musicVolume },
  };
  useFiles.getState().addMedia(item);
  onProgress?.('完成', 1);
  return item;
}

// 预览：把某一时刻画到给定 canvas 上（工作区的画面方案预览用，不编码）
export async function previewFrame(spec: SceneSpec, canvas: HTMLCanvasElement, t: number, images?: Map<string, ImageBitmap>) {
  const layout = layoutFor(spec.ratio);
  canvas.width = layout.w; canvas.height = layout.h;
  const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
  const theme = themeFor(spec.theme, spec.palette);
  const tl = timelineOf(spec);
  const stage: Stage = { ctx, spec, tl, layout, theme, measure: (s, size) => { ctx.font = `700 ${size}px ${theme.display}`; return ctx.measureText(s).width; }, images: images || new Map() };
  drawFrame(stage, Math.max(0, Math.min(tl.total - 0.001, t)));
}
export { loadImages };
