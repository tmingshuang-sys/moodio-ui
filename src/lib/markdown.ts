// ===== Markdown 文稿工具：章节切分、按标题替换、纯文本、文件名 =====
import type { Doc, DocKind } from './types';

export interface Section { level: number; heading: string; start: number; end: number; }   // 行号区间 [start, end)

export function splitLines(md: string): string[] { return String(md || '').replace(/\r\n?/g, '\n').split('\n'); }

// 只按 #..###### 标题切分；正文里的代码块暂不特殊处理（文稿以剧本 / 分镜 / 提示词为主）
export function sections(md: string): Section[] {
  const lines = splitLines(md); const out: Section[] = [];
  lines.forEach((line, i) => { const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line); if (m) out.push({ level: m[1].length, heading: m[2].trim(), start: i, end: lines.length }); });
  out.forEach((s, i) => { for (let j = i + 1; j < out.length; j++) { if (out[j].level <= s.level) { s.end = out[j].start; break; } } });
  return out;
}

export function findSection(md: string, heading: string): Section | null {
  const want = norm(heading); const all = sections(md);
  return all.find(s => norm(s.heading) === want) || all.find(s => norm(s.heading).includes(want) || want.includes(norm(s.heading))) || null;
}
const norm = (s: string) => String(s || '').toLowerCase().replace(/[\s#*_`「」《》“”"'（）()\-–—:：.。,，]/g, '');

export function sectionText(md: string, s: Section): string { return splitLines(md).slice(s.start, s.end).join('\n'); }

// 用新内容整段替换（含标题行）。newContent 若不以标题开头，保留原标题
export function replaceSection(md: string, s: Section, newContent: string): string {
  const lines = splitLines(md); const body = splitLines(newContent.trim());
  const withHeading = /^#{1,6}\s/.test(body[0] || '') ? body : [lines[s.start], ...body];
  const before = lines.slice(0, s.start), after = lines.slice(s.end);
  const gap = after.length && after[0].trim() !== '' ? [''] : [];
  return [...before, ...withHeading, ...gap, ...after].join('\n');
}

export function appendMarkdown(md: string, extra: string): string {
  const base = String(md || '').replace(/\s+$/, ''); const add = String(extra || '').trim();
  if (!base) return add; if (!add) return base;
  return base + '\n\n' + add + '\n';
}

// 去掉 Markdown 语法，用于卡片预览、字数与搜索
export function plainText(md: string): string {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, '')
    .replace(/\|/g, ' ')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map(l => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function previewLines(doc: Doc, n = 6): string[] {
  const text = doc.kind === 'md' ? plainText(doc.content) : String(doc.content || '');
  return text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, n);
}

export function kindFromName(name: string): DocKind {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return ext === 'json' ? 'json' : ext === 'txt' ? 'txt' : 'md';
}
export function ensureExt(name: string, kind: DocKind = 'md'): string {
  const clean = sanitizeName(name);
  return /\.(md|json|txt)$/i.test(clean) ? clean : `${clean}.${kind}`;
}
export function sanitizeName(name: string): string {
  return String(name || '').replace(/[\\/:*?"<>|\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '未命名';
}
export function uniqueName(existing: string[], name: string): string {
  const taken = new Set(existing.map(n => n.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  const m = /^(.*?)(\.[a-z0-9]+)?$/i.exec(name)!; const base = m[1], ext = m[2] || '';
  for (let i = 2; i < 999; i++) { const candidate = `${base}-${i}${ext}`; if (!taken.has(candidate.toLowerCase())) return candidate; }
  return `${base}-${Date.now().toString(36)}${ext}`;
}
export function baseName(name: string): string { return String(name || '').replace(/\.(md|json|txt)$/i, ''); }

// 文稿类别（按文件名判断）：剧本 / 分镜 / 提示词 / 人物 / 其他——用于选择写作规范与自审
export type DocRole = 'script' | 'storyboard' | 'prompt' | 'character' | 'other';
export function docRole(name: string): DocRole {
  const n = String(name || '');
  if (/prompt|提示词|生成/i.test(n)) return 'prompt';
  if (/分镜|storyboard|镜头/i.test(n)) return 'storyboard';
  if (/剧本|脚本|script|screenplay/i.test(n)) return 'script';
  if (/人物|角色|小传|character/i.test(n)) return 'character';
  return 'other';
}

export function wordCount(text: string): number { return plainText(text).replace(/\s/g, '').length; }
