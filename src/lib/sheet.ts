// ===== 拼图：把几张参考图（产品正面 / 侧面 / 顶面，或人物多视角）拼成一张带标签的分格图，当唯一参考图用 =====
import type { MediaItem } from './types';
import { uid } from './types';
import { useFiles } from './store';
import { getBlob, putBlob, cacheUrl } from './storage';

export interface SheetTile { id: string; label: string; }
export async function makeSheet(tiles: SheetTile[], { name = '三视图', group = '产品' }: { name?: string; group?: string } = {}): Promise<MediaItem> {
  if (!tiles.length) throw new Error('没有可拼的图片');
  const bitmaps: ImageBitmap[] = [];
  for (const t of tiles) { const blob = await getBlob(t.id); if (!blob) throw new Error(`图片 ${t.id} 不在本机媒体库里`); bitmaps.push(await createImageBitmap(blob)); }
  const H = Math.min(1024, Math.max(...bitmaps.map(b => b.height)));
  const gap = 32, pad = 40, labelH = 64;
  const widths = bitmaps.map(b => Math.round(b.width * H / b.height));
  const canvas = document.createElement('canvas');
  canvas.width = pad * 2 + widths.reduce((s, w) => s + w, 0) + gap * (bitmaps.length - 1); canvas.height = pad * 2 + H + labelH;
  const g = canvas.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  let x = pad;
  bitmaps.forEach((b, i) => {
    g.drawImage(b, x, pad, widths[i], H); b.close();
    g.fillStyle = '#1d1d1f'; g.font = `600 ${Math.round(labelH * 0.42)}px "PingFang SC", "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(tiles[i].label, x + widths[i] / 2, pad + H + labelH / 2);
    x += widths[i] + gap;
  });
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('拼图失败')), 'image/png'));
  const id = uid('m'); await putBlob(id, blob); cacheUrl(id, blob);
  const meta: MediaItem = { id, name: `${name.replace(/\.png$/i, '')}.png`, kind: 'image', mime: 'image/png', size: blob.size, group, createdAt: Date.now(), by: 'agent', width: canvas.width, height: canvas.height, model: '拼图' };
  useFiles.getState().addMedia(meta);
  return meta;
}
