// ===== 上传图片 / 视频 / 音频到媒体库：blob 进 IndexedDB，元数据进文件仓库 =====
// 音频（mp3 / wav / m4a）当配乐用：合成成片时 compose_video 的 music_id 引用它
import type { MediaItem } from './types';
import { uid } from './types';
import { useFiles } from './store';
import { putBlob, cacheUrl, downscaleImage, imageSize } from './storage';
import { toast } from '../components/Toast';

export function guessGroup(name: string, hint?: string): string {
  if (hint) return hint;
  const n = name.toLowerCase();
  if (/character|人物|角色|char|portrait|face/.test(n)) return '人物';
  if (/product|产品|商品|item/.test(n)) return '产品';
  if (/scene|场景|location|环境|bg|background/.test(n)) return '场景';
  if (/prop|道具/.test(n)) return '道具';
  return '其他';
}

export async function uploadFiles(list: FileList | File[], { group }: { group?: string } = {}): Promise<MediaItem[]> {
  const files = Array.from(list || []); const added: MediaItem[] = [];
  for (const f of files) {
    const isImg = f.type.startsWith('image/'), isVid = f.type.startsWith('video/'), isAud = f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name);
    if (!isImg && !isVid && !isAud) { toast(`${f.name}：仅支持图片、视频或音频`); continue; }
    if (f.size > 200 * 1024 * 1024) { toast(`${f.name} 超过 200MB，请压缩后再上传`); continue; }
    const blob = isImg ? await downscaleImage(f, f.type) : f;
    const id = uid('m');
    try { await putBlob(id, blob); } catch { toast('媒体保存失败：浏览器本地存储不可用'); continue; }
    cacheUrl(id, blob);
    const size = isImg ? await imageSize(blob) : null;
    const meta: MediaItem = { id, name: f.name, kind: isImg ? 'image' : isVid ? 'video' : 'audio', mime: f.type || (isAud ? 'audio/mpeg' : ''), size: blob.size, group: isAud ? '配乐' : guessGroup(f.name, group), createdAt: Date.now(), by: 'user', width: size?.width, height: size?.height };
    useFiles.getState().addMedia(meta); added.push(meta);
  }
  if (added.length) toast(`已添加 ${added.length} 个文件到工作区`);
  return added;
}

export function pickFiles(accept = 'image/*,video/*,audio/*', multiple = true): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.multiple = multiple; input.hidden = true;
    input.onchange = () => { resolve(Array.from(input.files || [])); input.remove(); };
    document.body.appendChild(input); input.click();
  });
}
