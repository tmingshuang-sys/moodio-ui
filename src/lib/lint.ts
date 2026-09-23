// ===== 片段方案校验：子镜头时段首尾相接且等于片段时长、片段之和等于纲领总时长、每个已激活卖点至少落在一个片段里 =====
// 进入「生成成片」阶段前由 update_ledger 把关；Agent 也可用 lint_clips 自查。
import { useFiles } from './store';
import { videoProfile } from './mediagen';
import { CLIP_FOCUS_LABELS } from './guides';
import { FROZEN_LABEL } from './skills';

export interface ClipInfo { no: number; name: string; seconds: number; ranges: [number, number][]; handoff?: { type: 'open' | 'cut' | 'continue'; prev?: string }; ending?: string; }   // handoff：这一段的「衔接」行；ending：「结尾状态」行
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
  // 段落衔接：「衔接：硬切——…」「衔接：接上一段——上一段结尾状态：…」「衔接：全片开场」；「结尾状态：…」
  let handoff: ClipInfo['handoff'];
  const h = /^\s*衔接[：:]\s*(.+)$/m.exec(content);
  if (h) { const t = h[1].trim(); const prev = /上一段结尾状态[：:]\s*(.+)$/.exec(t)?.[1]?.trim(); handoff = /^硬切/.test(t) ? { type: 'cut' } : /^(接上一段|接续)/.test(t) ? { type: 'continue', prev } : { type: 'open' }; }
  const e = /^\s*结尾状态[：:]\s*(.+)$/m.exec(content); const ending = e ? e[1].trim() : undefined;
  return { no, name, seconds, ranges, handoff, ending };
}

// 账本：任何带「落在哪个片段」列的表都算（卖点账本 / 意象账本 / 钩子账本 / 场景账本 / 道具账本…），一行一个要落地的元素
export interface SellingPoint { point: string; clip?: number; kind?: string; time?: number; }
const splitRow = (row: string) => row.split('|').slice(1, -1).map(s => s.trim());
export function ledgerRows(md: string, opts: { requireLanding?: boolean } = {}): SellingPoint[] {
  const out: SellingPoint[] = []; const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!/^\|.*\|$/.test(line)) continue;
    const headers = splitRow(line);
    const clipCol = headers.findIndex(h => /落在哪(个)?(片)?段|落在哪个段落/.test(h)); const pointCol = headers.findIndex(h => /^(卖点|意象|钩子|场景|道具|对象|元素)/.test(h));
    if (pointCol < 0 || (opts.requireLanding !== false && clipCol < 0)) continue;
    const stateCol = headers.findIndex(h => /状态/.test(h)); const timeCol = headers.findIndex(h => /时间点/.test(h)); const kind = headers[pointCol].replace(/[（(].*$/, '');
    for (let j = i + 2; j < lines.length; j++) {
      const row = lines[j].trim(); if (!/^\|.*\|$/.test(row)) break;
      const cells = splitRow(row); if (/^-+$/.test(cells[0] || '')) continue;
      const point = (cells[pointCol] || '').replace(/\*/g, '').trim(); if (!point) continue;
      if (stateCol >= 0 && cells[stateCol] && /备选|未激活|弃用|inactive/i.test(cells[stateCol])) continue;
      const clipNo = clipCol >= 0 ? parseInt((cells[clipCol] || '').replace(/[^0-9]/g, ''), 10) : NaN;
      const time = timeCol >= 0 ? parseFloat((cells[timeCol] || '').replace(/[^0-9.]/g, '')) : NaN;
      out.push({ point, kind, clip: Number.isFinite(clipNo) ? clipNo : undefined, time: Number.isFinite(time) ? time : undefined });
    }
    i += 1;
  }
  return out;
}
export const sellingPointRows = (md: string) => ledgerRows(md).filter(r => /卖点/.test(r.kind || ''));
export const activeSellingPoints = (md: string) => sellingPointRows(md).map(r => r.point);
// 人物小传里的音色描述：标题下的一行「音色：…」（旁白也算一个人物；写「无」的不算）
export function voiceDescriptions(md: string): { name: string; desc: string }[] {
  const out: { name: string; desc: string }[] = []; let heading = '';
  for (const raw of String(md || '').split('\n')) {
    const line = raw.trim(); const h = /^#{2,3}\s+(.+)$/.exec(line); if (h) { heading = h[1].replace(/[（(].*$/, '').trim(); continue; }
    const m = /^(?:[-*]\s*)?音色[：:]\s*(.+)$/.exec(line); if (m && heading) { const desc = m[1].trim(); if (desc.length >= 4 && !/^(无|不需要|没有)/.test(desc)) out.push({ name: heading, desc }); }
  }
  return out;
}
// 人物小传 / 人设 / 歌曲分析里的冻结外形描述：标题下最近的一行「冻结外形描述：…」
export function frozenDescriptions(md: string): { name: string; desc: string }[] {
  const out: { name: string; desc: string }[] = []; let heading = '';
  for (const raw of md.split('\n')) {
    const line = raw.trim(); const h = /^#{2,3}\s+(.+)$/.exec(line); if (h) { heading = h[1].replace(/[（(].*$/, '').trim(); continue; }
    const m = new RegExp(`^${FROZEN_LABEL}[：:]\\s*(.+)$`).exec(line); if (m && heading) { const desc = m[1].trim(); if (desc.length >= 8 && !/不出镜/.test(desc)) out.push({ name: heading, desc }); }
  }
  return out;
}
// 歌曲分析的段落表：起 / 止 秒数
export function songSegments(md: string): { name: string; start: number; end: number }[] {
  const out: { name: string; start: number; end: number }[] = []; const lines = md.split('\n');
  const toSec = (v: string) => { const t = v.trim(); const mm = /^(\d+)[:：](\d{1,2})$/.exec(t); if (mm) return parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10); const n = parseFloat(t.replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : NaN; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!/^\|.*\|$/.test(line)) continue;
    const headers = splitRow(line); const segCol = headers.findIndex(h => /段落/.test(h)); const sCol = headers.findIndex(h => /^起/.test(h)); const eCol = headers.findIndex(h => /^止/.test(h));
    if (segCol < 0 || sCol < 0 || eCol < 0) continue;
    for (let j = i + 2; j < lines.length; j++) { const row = lines[j].trim(); if (!/^\|.*\|$/.test(row)) break; const c = splitRow(row); if (/^-+$/.test(c[0] || '')) continue; const start = toSec(c[sCol] || ''), end = toSec(c[eCol] || ''); if (Number.isFinite(start) && Number.isFinite(end)) out.push({ name: c[segCol], start, end }); }
    break;
  }
  return out;
}
const normalize = (t: string) => t.replace(/\s+/g, '').replace(/[，,。.；;：:]/g, '');
const terms = (point: string) => point.split(/[，,、；;：:（）()\s/·]+/).map(s => s.trim()).filter(s => s.length >= 2);
const bigrams = (point: string) => { const out = new Set<string>(); for (const t of terms(point)) for (let i = 0; i + 2 <= t.length; i++) out.add(t.slice(i, i + 2)); return [...out]; };
// 卖点是否落地：账本里写了落在哪个片段且那段存在 → 认；否则看片段全文有没有完整的卖点词，或「品牌/产品露出」行里出现卖点碎词（那一行就是写画面怎么证明卖点的地方）
const FOCUS_RE = new RegExp(`(?:${CLIP_FOCUS_LABELS.map(l => l.replace('/', '\\/')).join('|')})[：:](.*)`, 'g');
const exposureText = (text: string) => [...text.matchAll(FOCUS_RE)].map(m => m[1]).join('\n');
function landed(sp: SellingPoint, clipTexts: Map<number, string>): boolean {
  if (sp.clip && clipTexts.has(sp.clip)) return true;
  const all = [...clipTexts.values()].join('\n');
  if (terms(sp.point).some(t => all.includes(t))) return true;
  const bg = bigrams(sp.point); const exposure = [...clipTexts.values()].map(exposureText).join('\n');
  return bg.some(b => exposure.includes(b));
}

export interface LintExtras { frozen?: { name: string; desc: string }[]; segments?: { name: string; start: number; end: number }[]; hooks?: SellingPoint[]; maxClip?: number; }   // maxClip = 当前视频模型的单段上限
export function lintClipDocs(docs: { name: string; content: string }[], sellingPoints: (string | SellingPoint)[], totalSeconds: number | null, extras: LintExtras = {}): ClipLint {
  const points: SellingPoint[] = sellingPoints.map(p => typeof p === 'string' ? { point: p } : p);
  const errors: string[] = [], warnings: string[] = [];
  const clips = docs.filter(d => CLIP_DOC_RE.test(d.name)).map(d => clipInfo(d.name, d.content)).sort((a, b) => a.no - b.no);
  if (!clips.length) return { errors: ['还没有片段提示词文稿（视频生成Prompt-01.md …）'], warnings, clips, sellingPoints: points.map(p => p.point) };
  clips.forEach((c, i) => {
    if (c.no !== i + 1) warnings.push(`片段编号不连续：第 ${i + 1} 份是「${c.name}」`);
    if (!c.seconds) { errors.push(`「${c.name}」没有写「时长：N秒」`); return; }
    if (extras.maxClip && c.seconds > extras.maxClip + 0.01) errors.push(`「${c.name}」时长 ${c.seconds} 秒超过当前视频模型单段上限 ${extras.maxClip} 秒，请拆成两段或换模型`);
    if (!c.ranges.length) { errors.push(`「${c.name}」没有按「0-4秒」这样的时段写子镜头`); return; }
    let cursor = 0;
    for (const [a, b] of c.ranges) { if (Math.abs(a - cursor) > 0.01) errors.push(`「${c.name}」时段 ${a}-${b} 秒与前一段不相接（应从 ${cursor} 秒开始）`); if (b <= a) errors.push(`「${c.name}」时段 ${a}-${b} 秒结束早于开始`); cursor = b; }
    if (Math.abs(cursor - c.seconds) > 0.01) errors.push(`「${c.name}」子镜头只排到 ${cursor} 秒，片段时长是 ${c.seconds} 秒`);
  });
  // 段落衔接：每个段界要么硬切要么接续；接续段的「衔接」句必须与上一段「结尾状态」逐字相同，否则两段接不上戏
  clips.forEach((c, i) => {
    const prev = i > 0 ? clips[i - 1] : null; const last = i === clips.length - 1;
    if (i > 0 && !c.handoff) errors.push(`「${c.name}」没有写「衔接：…」行（接上一段——上一段结尾状态：<逐字照抄上一段的结尾状态> 或 硬切——原因）`);
    if (!last && !c.ending) errors.push(`「${c.name}」没有写「结尾状态：…」行，下一段无法接戏（写清画面里有谁、位置朝向、姿态与动作进度、视线、道具、机位景别、光线）`);
    else if (!last && c.ending && normalize(c.ending).length < 12) warnings.push(`「${c.name}」的结尾状态太短，写不出可接戏的交接状态`);
    if (c.handoff?.type === 'continue') {
      if (!c.handoff.prev) errors.push(`「${c.name}」写了接上一段，但没有照抄「上一段结尾状态：…」`);
      else if (prev?.ending && normalize(prev.ending) !== normalize(c.handoff.prev)) errors.push(`「${c.name}」的衔接句与「${prev.name}」的结尾状态不一致，两段接不上戏——上一段结尾：${prev.ending.slice(0, 60)}；本段衔接：${c.handoff.prev.slice(0, 60)}`);
      else if (!prev) warnings.push(`「${c.name}」写了接上一段，但没有上一段的文稿可核对`);
    }
  });
  const sum = clips.reduce((s, c) => s + c.seconds, 0);
  if (totalSeconds && Math.abs(sum - totalSeconds) > Math.max(2, totalSeconds * 0.1)) warnings.push(`片段时长合计 ${sum} 秒，纲领总时长 ${totalSeconds} 秒，相差较大`);
  const clipTexts = new Map<number, string>(clips.map(c => [c.no, docs.find(d => d.name === c.name)?.content || '']));
  if (points.length) {
    for (const sp of points) if (!landed(sp, clipTexts)) errors.push(`${sp.kind || '卖点'}「${sp.point}」没有落在任何片段里（账本里写清落在哪个片段，或在该片段的画面 / ${sp.kind === '卖点' ? '产品露出' : '第四行'}里体现）`);
  }
  // 冻结外形描述：片段里提到这个人物，就必须原样带上小传里的那段描述
  for (const f of extras.frozen || []) {
    for (const c of clips) { const text = clipTexts.get(c.no) || ''; if (text.includes(f.name) && !normalize(text).includes(normalize(f.desc))) errors.push(`「${c.name}」提到了「${f.name}」，但没有原样使用人物小传里的冻结外形描述`); }
  }
  // MV：片段起止要落在歌曲段落边界上
  if (extras.segments?.length) {
    const bounds = new Set<number>([0, ...extras.segments.map(x => x.start), ...extras.segments.map(x => x.end)]);
    const near = (v: number) => [...bounds].some(b => Math.abs(b - v) <= 1);
    for (const c of clips) {
      const m = /full-film range[：:]?\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*s/i.exec(clipTexts.get(c.no) || '');
      if (!m) { warnings.push(`「${c.name}」没有写 full-film range，无法核对是否贴着歌曲段落切`); continue; }
      const [a, b] = [parseFloat(m[1]), parseFloat(m[2])];
      if (!near(a) || !near(b)) errors.push(`「${c.name}」的区间 ${a}-${b}s 没有落在歌曲段落边界上（边界：${[...bounds].sort((x, y) => x - y).join(' / ')}）`);
    }
  }
  // 短视频：第一个钩子 ≤ 3 秒且在第 1 段
  if (extras.hooks?.length) {
    const first = extras.hooks.slice().sort((a, b) => (a.time ?? 1e9) - (b.time ?? 1e9))[0];
    if (first.time === undefined) warnings.push('钩子账本没有写时间点，无法核对前 3 秒');
    else { if (first.time > 3) errors.push(`第一个钩子「${first.point}」在 ${first.time} 秒，必须在 3 秒以内`); if (first.clip && first.clip !== 1) errors.push(`第一个钩子「${first.point}」落在第 ${first.clip} 段，必须在第 1 段`); }
  }
  return { errors, warnings, clips, sellingPoints: points.map(p => p.point) };
}

export function lintClips(): ClipLint {
  const { docs, brief } = useFiles.getState();
  const others = docs.filter(d => !CLIP_DOC_RE.test(d.name) && d.kind === 'md');
  const points = others.flatMap(d => ledgerRows(d.content));                       // 所有带「落在哪个片段」列的账本
  const frozen = others.filter(d => /人物小传|人设与选题|歌曲分析|创作脑图/.test(d.name)).flatMap(d => frozenDescriptions(d.content));
  const song = docs.find(d => /^歌曲分析\.md$/.test(d.name)); const segments = song ? songSegments(song.content) : [];
  const hookDoc = docs.find(d => /^钩子账本\.md$/.test(d.name)); const hooks = hookDoc ? ledgerRows(hookDoc.content, { requireLanding: false }).filter(r => r.time !== undefined || /钩子/.test(r.kind || '')) : [];
  return lintClipDocs(docs.map(d => ({ name: d.name, content: d.content })), points, parseSeconds(brief?.duration), { frozen, segments, hooks, maxClip: videoProfile().maxClip });
}
export function lintSummary(r: ClipLint): string {
  const head = `片段 ${r.clips.length} 段，合计 ${r.clips.reduce((s, c) => s + c.seconds, 0)} 秒${r.sellingPoints.length ? `，账本元素 ${r.sellingPoints.length} 个` : ''}`;
  return [head, ...r.errors.map(e => '✗ ' + e), ...r.warnings.map(w => '△ ' + w), r.errors.length ? '' : '✓ 时长、落地与一致性都通过'].filter(Boolean).join('\n');
}
