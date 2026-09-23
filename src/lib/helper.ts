// ===== 本地助手：网页没法启动达芬奇（它没注册 URL scheme），也拿不到本机绝对路径，所以由 helper/moodio-helper.py 代劳 =====
// 助手在 127.0.0.1:17817 上听着：把片段 POST 给它，它写盘、生成 FCPXML、调达芬奇自带的脚本接口导入并切到剪辑页。
// 没装助手时一切照旧（导出片段文件夹），所以这是纯增量能力。
import { getBlob } from './storage';
import { findMedia } from './store';

export const HELPER_PORT = 17817;
export const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;
export const HELPER_FILE = '/moodio-helper.py';   // 放在 public/，用户下载后 python3 跑起来

export interface HelperStatus { ok: boolean; version?: string; resolveInstalled?: boolean; resolveRunning?: boolean; dir?: string; }

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

export interface SendResult { message: string; dir?: string; }
// 把片段按顺序送进达芬奇：先逐段上传，再让助手生成工程并导入
export async function sendToResolve(ids: string[], title: string, onProgress?: (t: string) => void): Promise<SendResult> {
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
  onProgress?.('正在让达芬奇打开时间线…');
  const r = await fetch(`${HELPER_URL}/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job, title, clips }) });
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
