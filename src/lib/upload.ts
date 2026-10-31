// ===== 上传文件：图片 / 视频 / 音频进媒体库（blob 进 IndexedDB），字幕 / 文字稿进文稿区 =====
// 音频（mp3 / wav / m4a）当配乐用：合成成片时 compose_video 的 music_id 引用它
// 字幕（.srt / .vtt）与文字稿（.txt / .md / .json）直接变成文稿，科普流水线的 import_transcript 按 doc_id 取用
import type { Doc, DocKind, MediaItem } from './types';
import { uid } from './types';
import { useFiles } from './store';
import { putBlob, cacheUrl, downscaleImage, imageSize } from './storage';
import { toast } from '../components/Toast';

export const TEXT_EXT = /\.(txt|md|markdown|json|srt|vtt|csv|ass)$/i;
export const docKindOf = (name: string): DocKind => (/\.json$/i.test(name) ? 'json' : /\.(md|markdown)$/i.test(name) ? 'md' : 'txt');
// 文稿只认 .md / .json / .txt，所以字幕这些扩展名要换掉而不是往后再加一节（不然成了「CS229.vtt.txt」）
export function docNameOf(name: string): string {
  const kind = docKindOf(name);
  return /\.(md|json|txt)$/i.test(name) ? name : `${name.replace(/\.[^.]+$/, '')}.${kind}`;
}
export const ACCEPT_ALL = 'image/*,video/*,audio/*,text/*,.srt,.vtt,.ass,.md,.json,.csv';

// 一批文件分成三摊：进媒体库的、进文稿区的、两边都收不了的（纯函数，便于单测）
export function partitionFiles(list: FileList | File[]): { media: File[]; text: File[]; rejected: File[] } {
  const media: File[] = [], text: File[] = [], rejected: File[] = [];
  for (const f of Array.from(list || [])) {
    if (f.type.startsWith('image/') || f.type.startsWith('video/')) media.push(f);
    else if (f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(f.name)) media.push(f);
    else if (TEXT_EXT.test(f.name) || f.type.startsWith('text/') || f.type === 'application/json') text.push(f);
    else rejected.push(f);
  }
  return { media, text, rejected };
}

export function guessGroup(name: string, hint?: string): string {
  if (hint) return hint;
  const n = name.toLowerCase();
  if (/character|人物|角色|char|portrait|face/.test(n)) return '人物';
  if (/product|产品|商品|item/.test(n)) return '产品';
  if (/scene|场景|location|环境|bg|background/.test(n)) return '场景';
  if (/prop|道具/.test(n)) return '道具';
  return '其他';
}

export async function uploadFiles(list: FileList | File[], { group, quiet }: { group?: string; quiet?: boolean } = {}): Promise<MediaItem[]> {
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
  if (added.length && !quiet) toast(`已添加 ${added.length} 个文件到工作区`);
  return added;
}

// 拖进来的一批文件统一走这里：媒体进媒体库、字幕与文字稿进文稿区，收不了的逐个说明
export async function importFiles(list: FileList | File[], { group }: { group?: string } = {}): Promise<{ media: MediaItem[]; docs: Doc[] }> {
  const { media, text, rejected } = partitionFiles(list);
  for (const f of rejected) toast(`${f.name}：只收图片、视频、音频、字幕和文字稿`);
  const addedMedia = media.length ? await uploadFiles(media, { group, quiet: true }) : [];
  const addedDocs: Doc[] = [];
  for (const f of text) {
    if (f.size > 8 * 1024 * 1024) { toast(`${f.name} 超过 8MB，文稿放不下`); continue; }
    let content = '';
    try { content = await f.text(); } catch { toast(`${f.name} 读不出来`); continue; }
    addedDocs.push(useFiles.getState().addDoc({ name: docNameOf(f.name), content, kind: docKindOf(f.name), by: 'import' }));
  }
  const n = addedMedia.length + addedDocs.length;
  if (n) {
    useFiles.getState().setUi({ paneOpen: true });
    const last = addedDocs[addedDocs.length - 1];
    if (last && addedDocs.length === 1 && !addedMedia.length) useFiles.getState().openInPane(last.id);
    toast(n === 1 ? `已添加「${(addedDocs[0] || addedMedia[0]).name}」到工作区` : `已添加 ${n} 个文件到工作区`);
  }
  return { media: addedMedia, docs: addedDocs };
}

export function pickFiles(accept = 'image/*,video/*,audio/*', multiple = true): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = accept; input.multiple = multiple; input.hidden = true;
    input.onchange = () => { resolve(Array.from(input.files || [])); input.remove(); };
    document.body.appendChild(input); input.click();
  });
}
