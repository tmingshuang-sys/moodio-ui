// ===== 片段方案校验：子镜头时段首尾相接且等于片段时长、片段之和等于纲领总时长、每个已激活卖点至少落在一个片段里 =====
// 进入「生成成片」阶段前由 update_ledger 把关；Agent 也可用 lint_clips 自查。
import { useFiles } from './store';

export interface ClipInfo { no: number; name: string; seconds: number; ranges: [number, number][]; }
export interface ClipLint { errors: string[]; warnings: string[]; clips: ClipInfo[]; sellingPoints: string[]; }

export const CLIP_DOC_RE = /^视频生成Prompt-(\d{1,2})\.md$/i;

// 纲领里的总时长：「60 秒」「1 分钟」「90s」「3 分 42 秒」
export function parseSeconds(text: string | undefined): number | null {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return null;
  const mm = /(\d+(?:\.\d+)?)分(?:钟)?(?:(\d+)秒)?/.exec(t); if (mm) return Math.round(parseFloat(mm[1]) * 60 + (parseInt(mm[2] || '0', 10) || 0));
  const ss = /(\d+(?:\.\d+)?)(?:秒|s)/i.exec(t); if (ss) return Math.round(parseFloat(ss[1]));
  const mins = /(\d+(?:\.\d+)?)(?:min|分)/i.exec(t); if (mins) return Math.round(parseFloat(mins[1]) * 60);
  return null;
}

function clipInfo(name: string, content: string): ClipInfo {
  const no = parseInt(CLIP_DOC_RE.exec(name)![1], 10);
  const sec = /时长[：:]\s*(\d+(?:\.\d+)?)\s*(?:秒|s)/i.exec(content); const seconds = sec ? parseFloat(sec[1]) : 0;
  const ranges: [number, number][] = [];
  for (const m of content.matchAll(/^\s*(\d+(?:\.\d+)?)\s*[-–—~]\s*(\d+(?:\.\d+)?)\s*秒\s*$/gm)) ranges.push([parseFloat(m[1]), parseFloat(m[2])]);
  return { no, name, seconds, ranges };
}

// 卖点账本：找带「卖点」列的表格，取「状态」为已激活（或没有状态列）的行，顺带读「落在哪个片段」
export interface SellingPoint { point: string; clip?: number; }
export function sellingPointRows(md: string): SellingPoint[] {
  const out: SellingPoint[] = [];
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!/^\|.*\|$/.test(line) || !/卖点/.test(line)) continue;
    const headers = line.split('|').slice(1, -1).map(s => s.trim());
    const pointCol = headers.findIndex(h => h === '卖点' || /^卖点/.test(h)); const stateCol = headers.findIndex(h => /状态/.test(h)); const clipCol = headers.findIndex(h => /片段/.test(h));
    if (pointCol < 0) continue;
    for (let j = i + 2; j < lines.length; j++) {
      const row = lines[j].trim(); if (!/^\|.*\|$/.test(row)) break;
      const cells = row.split('|').slice(1, -1).map(s => s.trim());
      if (/^-+$/.test(cells[0] || '')) continue;
      const point = (cells[pointCol] || '').replace(/\*/g, '').trim(); if (!point) continue;
      if (stateCol >= 0 && cells[stateCol] && !/已激活|激活|active/i.test(cells[stateCol])) continue;
      const clipNo = clipCol >= 0 ? parseInt((cells[clipCol] || '').replace(/[^0-9]/g, ''), 10) : NaN;
      out.push({ point, clip: Number.isFinite(clipNo) ? clipNo : undefined });
    }
    break;
  }
  return out;
}
export const activeSellingPoints = (md: string) => sellingPointRows(md).map(r => r.point);
const terms = (point: string) => point.split(/[，,、；;：:（）()\s/·]+/).map(s => s.trim()).filter(s => s.length >= 2);
const bigrams = (point: string) => { const out = new Set<string>(); for (const t of terms(point)) for (let i = 0; i + 2 <= t.length; i++) out.add(t.slice(i, i + 2)); return [...out]; };
// 卖点是否落地：账本里写了落在哪个片段且那段存在 → 认；否则看片段全文有没有完整的卖点词，或「品牌/产品露出」行里出现卖点碎词（那一行就是写画面怎么证明卖点的地方）
const exposureText = (text: string) => [...text.matchAll(/品牌\/产品露出[：:](.*)/g)].map(m => m[1]).join('\n');
function landed(sp: SellingPoint, clipTexts: Map<number, string>): boolean {
  if (sp.clip && clipTexts.has(sp.clip)) return true;
  const all = [...clipTexts.values()].join('\n');
  if (terms(sp.point).some(t => all.includes(t))) return true;
  const bg = bigrams(sp.point); const exposure = [...clipTexts.values()].map(exposureText).join('\n');
  return bg.some(b => exposure.includes(b));
}

export function lintClipDocs(docs: { name: string; content: string }[], sellingPoints: (string | SellingPoint)[], totalSeconds: number | null): ClipLint {
  const points: SellingPoint[] = sellingPoints.map(p => typeof p === 'string' ? { point: p } : p);
  const errors: string[] = [], warnings: string[] = [];
  const clips = docs.filter(d => CLIP_DOC_RE.test(d.name)).map(d => clipInfo(d.name, d.content)).sort((a, b) => a.no - b.no);
  if (!clips.length) return { errors: ['还没有片段提示词文稿（视频生成Prompt-01.md …）'], warnings, clips, sellingPoints: points.map(p => p.point) };
  clips.forEach((c, i) => {
    if (c.no !== i + 1) warnings.push(`片段编号不连续：第 ${i + 1} 份是「${c.name}」`);
    if (!c.seconds) { errors.push(`「${c.name}」没有写「时长：N秒」`); return; }
    if (!c.ranges.length) { errors.push(`「${c.name}」没有按「0-4秒」这样的时段写子镜头`); return; }
    let cursor = 0;
    for (const [a, b] of c.ranges) { if (Math.abs(a - cursor) > 0.01) errors.push(`「${c.name}」时段 ${a}-${b} 秒与前一段不相接（应从 ${cursor} 秒开始）`); if (b <= a) errors.push(`「${c.name}」时段 ${a}-${b} 秒结束早于开始`); cursor = b; }
    if (Math.abs(cursor - c.seconds) > 0.01) errors.push(`「${c.name}」子镜头只排到 ${cursor} 秒，片段时长是 ${c.seconds} 秒`);
  });
  const sum = clips.reduce((s, c) => s + c.seconds, 0);
  if (totalSeconds && Math.abs(sum - totalSeconds) > Math.max(2, totalSeconds * 0.1)) warnings.push(`片段时长合计 ${sum} 秒，纲领总时长 ${totalSeconds} 秒，相差较大`);
  if (points.length) {
    const clipTexts = new Map<number, string>(clips.map(c => [c.no, docs.find(d => d.name === c.name)?.content || '']));
    for (const sp of points) if (!landed(sp, clipTexts)) errors.push(`卖点「${sp.point}」没有落在任何片段里（账本里写清落在哪个片段，或在该片段的画面 / 产品露出里体现）`);
  }
  return { errors, warnings, clips, sellingPoints: points.map(p => p.point) };
}

export function lintClips(): ClipLint {
  const { docs, brief } = useFiles.getState();
  const ledgerDoc = docs.find(d => /^(营销脑图|卖点账本)\.md$/.test(d.name));
  const points = ledgerDoc ? sellingPointRows(ledgerDoc.content) : [];
  return lintClipDocs(docs.map(d => ({ name: d.name, content: d.content })), points, parseSeconds(brief?.duration));
}
export function lintSummary(r: ClipLint): string {
  const head = `片段 ${r.clips.length} 段，合计 ${r.clips.reduce((s, c) => s + c.seconds, 0)} 秒${r.sellingPoints.length ? `，已激活卖点 ${r.sellingPoints.length} 个` : ''}`;
  return [head, ...r.errors.map(e => '✗ ' + e), ...r.warnings.map(w => '△ ' + w), r.errors.length ? '' : '✓ 时长与卖点落地都通过'].filter(Boolean).join('\n');
}
