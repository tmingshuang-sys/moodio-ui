// ===== 本地助手：网页没法启动达芬奇（它没注册 URL scheme），也拿不到本机绝对路径，所以由 helper/moodio-helper.py 代劳 =====
// 助手在 127.0.0.1:17817 上听着：把片段 POST 给它，它写盘、生成 FCPXML、调达芬奇自带的脚本接口导入并切到剪辑页。
// 没装助手时一切照旧（导出片段文件夹），所以这是纯增量能力。
import { getBlob } from './storage';
import { findMedia } from './store';
import type { ComposeRecipe } from './types';

export const HELPER_PORT = 17817;
export const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;
export const HELPER_FILE = '/moodio-helper.py';   // 放在 public/，用户下载后 python3 跑起来

export interface HelperStatus { ok: boolean; version?: string; resolveInstalled?: boolean; resolveRunning?: boolean; ytdlp?: boolean; dir?: string; }

let cached: { at: number; status: HelperStatus } | null = null;
// 探测：默认最多等 1.5 秒，结果缓存 10 秒，免得每次点按钮都等
export async function pingHelper(timeoutMs = 1500, maxAgeMs = 10_000): Promise<HelperStatus> {
  if (cached && Date.now() - cached.at < maxAgeMs) return cached.status;
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${HELPER_URL}/ping`, { signal: ac.signal });
    const status: HelperStatus = r.ok ? await r.json() : { ok: false };
    cached = { at: Date.now(), status }; return status;
  } catch { const status = { ok: false }; cached = { at: Date.now(), status }; return status; }
  finally { clearTimeout(timer); }
}
export const forgetHelper = () => { cached = null; };

// 课程字幕：浏览器没法直接抓 YouTube 字幕（2026 年起 timedtext 要 PoToken），所以交给本机助手的 yt-dlp
export interface FetchedCaptions { title: string; duration: number; uploader: string; url: string; auto: boolean; captions: string; }
export async function fetchCaptions(url: string, lang = 'zh,zh-Hans,en', timeoutMs = 300_000): Promise<FetchedCaptions> {
  const status = await pingHelper();
  if (!status.ok) throw new Error('本机助手没在运行。下载 moodio-helper.py 后 `python3 moodio-helper.py` 跑起来，就能直接用课程链接导入；也可以把字幕文件（.srt / .vtt）拖进工作区。');
  if (status.ytdlp === false) throw new Error('本机助手跑起来了，但没找到 yt-dlp（装一个即可：pip install yt-dlp）。也可以把字幕文件（.srt / .vtt）直接拖进工作区。');
  const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(`${HELPER_URL}/transcript?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`, { signal: ac.signal });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(String(data.error || '没能抓到字幕'));
    return { title: String(data.title || ''), duration: Number(data.duration) || 0, uploader: String(data.uploader || ''), url: String(data.webpage_url || url), auto: !!data.auto, captions: String(data.captions || '') };
  } finally { clearTimeout(timer); }
}

export interface SendResult { message: string; dir?: string; }
// 把片段按顺序送进达芬奇：先逐段上传，再让助手生成工程并导入
export async function sendToResolve(ids: string[], title: string, onProgress?: (t: string) => void, recipe?: ComposeRecipe): Promise<SendResult> {
  if (!ids.length) throw new Error('没有可导出的片段');
  const job = title;
  const clips: { file: string; name: string; seconds: number; width?: number; height?: number }[] = [];
  for (let i = 0; i < ids.length; i++) {
    const m = findMedia(ids[i]); if (!m) throw new Error('片段已不在媒体库里');
    const blob = await getBlob(m.id); if (!blob) throw new Error(`「${m.name}」的文件不在本机媒体库里`);
    const ext = (/\.([a-z0-9]{2,4})$/i.exec(m.name)?.[1] || 'mp4').toLowerCase();
    const file = `clip_${String(i + 1).padStart(2, '0')}.${ext}`;
    let seconds = m.duration || 0, width = m.width || 0, height = m.height || 0;
    if (!seconds || !width) { const p = await probe(blob); seconds = seconds || p.seconds; width = width || p.width; height = height || p.height; }
    onProgress?.(`传送片段 ${i + 1}/${ids.length}…`);
    const r = await fetch(`${HELPER_URL}/file?job=${encodeURIComponent(job)}&name=${encodeURIComponent(file)}`, { method: 'POST', body: blob });
    if (!r.ok) throw new Error(`片段 ${file} 没传成功（${r.status}）`);
    clips.push({ file, name: m.name, seconds, width: width || undefined, height: height || undefined });
  }
  // 配乐与配音：成片记着它们，一并传上去挂成独立音频轨；字幕交给助手写成 SRT
  const audios: { file: string; name: string; seconds: number; start: number; volume?: number; role?: string }[] = [];
  const pushAudio = async (id: string, start: number, volume: number | undefined, role: string, tag: string) => {
    const m = findMedia(id); if (!m) return;
    const blob = await getBlob(m.id); if (!blob) return;
    const ext = (/\.([a-z0-9]{2,4})$/i.exec(m.name)?.[1] || 'mp3').toLowerCase();
    const file = `${tag}.${ext}`;
    let seconds = m.duration || 0;
    if (!seconds) seconds = (await probe(blob)).seconds;
    if (!seconds) return;
    onProgress?.(`传送${role === 'music' ? '配乐' : '配音'}…`);
    const up = await fetch(`${HELPER_URL}/file?job=${encodeURIComponent(job)}&name=${encodeURIComponent(file)}`, { method: 'POST', body: blob });
    if (!up.ok) return;
    audios.push({ file, name: m.name, seconds, start, volume, role });
  };
  if (recipe?.musicId) await pushAudio(recipe.musicId, 0, recipe.musicVolume, 'music', 'music');
  const voices = recipe?.voices || [];
  for (let i = 0; i < voices.length; i++) await pushAudio(voices[i].id, voices[i].start || 0, voices[i].volume, 'dialogue', `voice_${String(i + 1).padStart(2, '0')}`);
  onProgress?.('正在让达芬奇打开时间线…');
  const r = await fetch(`${HELPER_URL}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job, title, clips, audios, subtitles: recipe?.subtitles || [] }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || data.message || '达芬奇没能打开这条时间线');
  return { message: String(data.message || '已送进达芬奇'), dir: data.dir };
}

function probe(blob: Blob): Promise<{ seconds: number; width: number; height: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true; v.src = url;
    const done = (d: number) => { URL.revokeObjectURL(url); resolve({ seconds: d, width: v.videoWidth || 0, height: v.videoHeight || 0 }); };
    v.onloadedmetadata = () => { if (isFinite(v.duration) && v.duration > 0) done(v.duration); else { v.ontimeupdate = () => { v.ontimeupdate = null; done(isFinite(v.duration) ? v.duration : 0); }; v.currentTime = 1e6; } };
    v.onerror = () => { URL.revokeObjectURL(url); resolve({ seconds: 0, width: 0, height: 0 }); };
  });
}
