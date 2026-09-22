// ===== 本地存储：JSON 存 localStorage（按项目隔离），媒体 blob 存 IndexedDB =====
import { createStore, get, set, del, keys } from 'idb-keyval';

export function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function writeJSON(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { console.warn('本地保存失败', error); return false; }
}

// 媒体库：所有项目共用一个 IndexedDB（id 全局唯一）；首次用到时才打开数据库（测试环境没有 indexedDB）
let mediaStore: ReturnType<typeof createStore> | null = null;
const store = () => (mediaStore ||= createStore('moodio-media', 'blobs'));
const urlCache = new Map<string, string>();

export async function putBlob(id: string, blob: Blob) { await set(id, blob, store()); }
export async function getBlob(id: string): Promise<Blob | undefined> { return get<Blob>(id, store()); }
export async function delBlob(id: string) { await del(id, store()); const url = urlCache.get(id); if (url) { URL.revokeObjectURL(url); urlCache.delete(id); } }
export async function listBlobIds(): Promise<string[]> { return (await keys(store())).map(String); }
export function cacheUrl(id: string, blob: Blob) { const url = URL.createObjectURL(blob); urlCache.set(id, url); return url; }
export async function mediaUrl(id: string): Promise<string | null> {
  const hit = urlCache.get(id); if (hit) return hit;
  const blob = await getBlob(id); if (!blob) return null;
  return cacheUrl(id, blob);
}

// 图片过大时缩到 1800px 以内再入库
export function downscaleImage(file: Blob, type: string): Promise<Blob> {
  return new Promise(resolve => {
    if (type === 'image/gif' || type === 'image/svg+xml') return resolve(file);
    const img = new Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1800, w = img.naturalWidth, h = img.naturalHeight;
      if ((w <= max && h <= max && file.size < 1.5e6)) { URL.revokeObjectURL(u); return resolve(file); }
      const k = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { URL.revokeObjectURL(u); resolve(b || file); }, type === 'image/png' ? 'image/png' : 'image/jpeg', .88);
    };
    img.onerror = () => { URL.revokeObjectURL(u); resolve(file); };
    img.src = u;
  });
}

export function imageSize(blob: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image(); const u = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(u); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(u); resolve(null); };
    img.src = u;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl); if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  try {
    if (m[2]) { const bin = atob(m[3]); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
    return new Blob([decodeURIComponent(m[3])], { type: mime });
  } catch { return null; }
}

export function downloadText(name: string, text: string, mime = 'text/markdown') {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  downloadBlob(name, blob);
}
export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
