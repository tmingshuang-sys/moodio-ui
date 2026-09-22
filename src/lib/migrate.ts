// ===== 旧版原型数据迁移：剧本块 → Markdown 剧本，封面 / 梗概 / 大纲 / 空白文档 → MD，分镜 → 分镜表.md，资产 → 人物 / 场景 / 道具文档 + 图片 =====
// 旧数据键：moodio-ui-refined-storyboard-v1::<项目id>（只读，不删除，切回旧版分支仍可用）
import type { Brief, Doc, MediaItem } from './types';
import { uid } from './types';
import { readJSON } from './storage';

interface LegacyBlock { id?: string; type: string; text: string; }
interface LegacyFile { id: string; type: string; title?: string; scriptBlocks?: LegacyBlock[]; docHtml?: string; editableText?: Record<string, string>; content?: string; }
interface LegacyShot { id: string; scene?: string; description?: string; camera?: { size?: string; angle?: string; movement?: string }; duration?: number; dialogueCue?: string; boardFileId?: string; sourceIds?: string[]; }
interface LegacyAsset { id: string; name: string; meta?: string; description?: string; image?: string; selected?: string[]; aliases?: string[]; variants?: string[]; }
interface LegacyWorkspace { fileStores?: { film?: Record<string, LegacyFile[]> }; shots?: LegacyShot[]; catalog?: Record<string, LegacyAsset[]>; brief?: Brief | null; episodes?: { id: string; title: string; workspace?: LegacyWorkspace | null }[]; activeEpisodeId?: string | null; }

export interface LegacyResult { docs: Doc[]; media: { meta: MediaItem; dataUrl: string }[]; brief: Brief | null; }

const TYPE_NAME: Record<string, string> = { cover: '封面', synopsis: '故事梗概', outline: '故事大纲', episodeOutline: '分集大纲', script: '剧本正文', storyboard: '分镜表', custom: '空白页面' };

export function blocksToMarkdown(blocks: LegacyBlock[]): string {
  const out: string[] = [];
  let lastType = '';
  for (const b of blocks || []) {
    const text = String(b.text || '').trim(); if (!text) continue;
    switch (b.type) {
      case 'scene': out.push((out.length ? '\n' : '') + `## ${text}\n`); break;
      case 'character': out.push(`**${text}**`); break;
      case 'dialogue': out.push(text + '\n'); break;
      case 'paren': out.push(`（${text.replace(/^[（(]|[）)]$/g, '')}）`); break;
      case 'transition': out.push(`*${text}*\n`); break;
      case 'subtitle': out.push(`> ${text}\n`); break;
      default: out.push((lastType === 'character' ? '' : '') + text + '\n');
    }
    lastType = b.type;
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function htmlToMarkdown(html: string): string {
  return String(html || '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n').replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n').replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n').replace(/<(br|\/p|\/div|\/tr|\/ul|\/ol|\/blockquote)>/gi, '\n')
    .replace(/<(b|strong)[^>]*>(.*?)<\/(b|strong)>/gi, '**$2**').replace(/<(i|em)[^>]*>(.*?)<\/(i|em)>/gi, '*$2*')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function shotsToMarkdown(shots: LegacyShot[]): string {
  const rows = shots.map((s, i) => `| ${String(i + 1).padStart(2, '0')} | ${s.scene || ''} | ${s.camera?.size || ''} | ${s.camera?.angle || ''} | ${s.camera?.movement || ''} | ${s.duration || ''} | ${String(s.description || '').replace(/\|/g, '／').replace(/\n/g, ' ')} | ${String(s.dialogueCue || '').replace(/\|/g, '／')} |`);
  return `# 分镜表\n\n| 镜号 | 场次 | 景别 | 角度 | 运镜 | 时长(秒) | 画面描述 | 台词 / 音效 |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function assetsToMarkdown(title: string, list: LegacyAsset[]): string {
  return `# ${title}\n\n` + list.map(a => `## ${a.name}\n\n${a.meta ? `- 概况：${a.meta}\n` : ''}${(a.aliases || []).length ? `- 别名：${a.aliases!.join('、')}\n` : ''}${a.description ? `\n${a.description}\n` : ''}`).join('\n');
}

function extOf(dataUrl: string): string { const m = /^data:image\/(png|jpe?g|gif|webp)/i.exec(dataUrl); const t = (m?.[1] || 'png').toLowerCase(); return t === 'jpeg' ? 'jpg' : t; }

function convertWorkspace(ws: LegacyWorkspace, prefix: string, at: number): Doc[] {
  const docs: Doc[] = []; const stores = ws.fileStores?.film || {};
  const mk = (name: string, content: string): Doc => ({ id: uid('d'), name: `${prefix}${name}.md`, kind: 'md', content, createdAt: at, updatedAt: at, by: 'import' });
  for (const [type, files] of Object.entries(stores)) {
    for (const f of files || []) {
      const title = String(f.title || TYPE_NAME[type] || type).trim();
      if (type === 'script' && Array.isArray(f.scriptBlocks)) { if (f.scriptBlocks.some(b => String(b.text || '').trim())) docs.push(mk(title || '剧本正文', `# ${title || '剧本正文'}\n\n${blocksToMarkdown(f.scriptBlocks)}`)); continue; }
      if (type === 'cover') { const et = f.editableText || {}; const parts = [et['content:0'] ? `# ${et['content:0']}` : '', et['content:1'] ? `编剧：${et['content:1']}` : '', et['content:2'] ? `一句话故事：${et['content:2']}` : '']; const text = parts.filter(Boolean).join('\n\n'); if (text) docs.push(mk('封面', text + '\n')); continue; }
      if (type === 'storyboard') continue;   // 分镜从 shots 转
      const body = f.docHtml ? htmlToMarkdown(f.docHtml) : f.editableText ? Object.values(f.editableText).join('\n\n').trim() : String(f.content || '').trim();
      if (body) docs.push(mk(title, (/^#\s/.test(body) ? '' : `# ${title}\n\n`) + body + '\n'));
    }
  }
  const shots = (ws.shots || []).filter(s => s && String(s.description || '').trim());
  if (shots.length) docs.push(mk('分镜表', shotsToMarkdown(shots)));
  return docs;
}

export function migrateLegacyWorkspace(projectId: string): LegacyResult | null {
  const raw = readJSON<LegacyWorkspace | null>('moodio-ui-refined-storyboard-v1::' + projectId, null);
  if (!raw || (!raw.fileStores && !raw.catalog && !raw.shots)) return null;
  const at = Date.now() - 60e3;
  const docs: Doc[] = convertWorkspace(raw, '', at);
  for (const ep of raw.episodes || []) { if (ep.id === raw.activeEpisodeId || !ep.workspace) continue; docs.push(...convertWorkspace(ep.workspace, `${ep.title} · `, at)); }
  const media: LegacyResult['media'] = [];
  const catalog = raw.catalog || {};
  const groups: [string, string, string][] = [['character', '人物', '人物小传'], ['location', '场景', '场景设定'], ['prop', '道具', '道具设定'], ['style', '其他', '风格参考']];
  for (const [key, group, title] of groups) {
    const list = (catalog[key] || []).filter(a => a && a.name);
    if (!list.length) continue;
    docs.push({ id: uid('d'), name: `${title}.md`, kind: 'md', content: assetsToMarkdown(title, list), createdAt: at, updatedAt: at, by: 'import' });
    for (const a of list) {
      const images = [a.image, ...(a.selected || [])].filter(src => typeof src === 'string' && src.startsWith('data:image/')) as string[];
      images.slice(0, 3).forEach((src, i) => { const id = uid('m'); media.push({ meta: { id, name: `${a.name}${i ? '-' + (i + 1) : ''}.${extOf(src)}`, kind: 'image', mime: src.slice(5, src.indexOf(';')) || 'image/png', size: Math.round(src.length * 0.75), group, createdAt: at, by: 'import' }, dataUrl: src }); });
    }
  }
  if (!docs.length && !media.length) return null;
  return { docs, media, brief: raw.brief || null };
}
