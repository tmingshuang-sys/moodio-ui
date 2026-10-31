// ===== 画面方案（scene spec）：科普视频的「代码底稿」=====
// 一条 60 秒科普视频 = 一份「画面-NN.json」。它同时是三样东西的唯一事实源：
//   ① 口播稿（每个 beat 的 say 就是要念的那句话）② 画面（template + 字段决定这一段画什么）③ 字幕（say 原样烧进画面）
// 时间轴由口播驱动：配音阶段把每句的真实音频时长写回 beat.seconds，画面按它排，所以声画天然对齐，不需要人工对时间。
// 这个文件只做纯计算（类型、规整、时间轴、字数估时），不碰 canvas，便于单测。
import type { Subtitle } from '../compose';

export const SCENE_TEMPLATES = ['hook', 'title', 'bullets', 'term', 'compare', 'number', 'steps', 'chart', 'formula', 'quote', 'image', 'diagram', 'endcard'] as const;
export type SceneTemplate = typeof SCENE_TEMPLATES[number];
export const RATIOS = ['9:16', '16:9', '1:1'] as const;
export type SceneRatio = typeof RATIOS[number];

export interface ChartSpec { kind: 'line' | 'bar' | 'pie'; values: number[]; labels?: string[]; label?: string; }
export interface FormulaPart { token: string; note: string; }
export interface FormulaSpec { body: string; parts?: FormulaPart[]; }

export interface Beat {
  say: string;                 // 这一段的口播原文，也是字幕；空串表示只有画面没有话
  template: SceneTemplate;
  seconds: number;             // 这一段的时长；配音后写回真实音频时长，没配音时按字数估
  heading?: string;            // 小标题 / 术语名 / 章节名
  text?: string;               // 主文案（大字、解释、引用正文）
  items?: string[];            // bullets 要点 / steps 步骤 / diagram 节点
  left?: string; right?: string;        // compare 左右两栏
  leftLabel?: string; rightLabel?: string;
  value?: string; unit?: string;        // number 大数字
  chart?: ChartSpec;
  formula?: FormulaSpec;
  mediaId?: string;            // image：媒体库里的图片 id
  caption?: string;            // image 的图注
  source?: string;             // quote 的出处（课程名 + 时间码）
  emphasis?: string[];         // say 里要重读 / 字幕里标重点的词
  voiceId?: string;            // 配音媒体 id（配音阶段写回）
}

export interface SceneSpec {
  title: string;               // 这条视频的标题（也进片头与进度条）
  no?: number;                 // 这是系列里的第几条
  topic?: string;              // 知识点名（来自知识点清单）
  ratio: SceneRatio;
  fps: number;
  theme: string;               // 风格模板 id（见 theme.ts）
  palette?: Record<string, string>;     // 覆盖风格模板里的某几个颜色
  watermark?: string;          // 右下角署名 / 账号名
  progress: boolean;           // 顶部进度条
  subtitle: boolean;           // 把 say 烧成字幕
  music?: string;              // 配乐媒体 id
  musicVolume?: number;
  source?: string;             // 整条片子的素材出处（课程名），片尾标注
  beats: Beat[];
}

// 中文口播大约 4.8 字 / 秒（MiniMax 默认语速实测），句末留 0.35 秒气口；英文按 2.2 词 / 秒折算
export const CHARS_PER_SECOND = 4.8;
const TAIL_PAUSE = 0.35;
export const MIN_BEAT = 1.2, MAX_BEAT = 20;

export function estimateSeconds(say: string): number {
  const s = String(say || '').trim(); if (!s) return MIN_BEAT;
  const cjk = (s.match(/[㐀-鿿぀-ヿ]/g) || []).length;
  const words = (s.replace(/[㐀-鿿぀-ヿ]/g, ' ').match(/[A-Za-z0-9][A-Za-z0-9'’.-]*/g) || []).length;
  const secs = cjk / CHARS_PER_SECOND + words / 2.2 + TAIL_PAUSE;
  return Math.min(MAX_BEAT, Math.max(MIN_BEAT, Math.round(secs * 10) / 10));
}

const str = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lines = (v: unknown, max = 6) => (Array.isArray(v) ? v : []).map(x => str(x, 60)).filter(Boolean).slice(0, max);
const isTemplate = (v: unknown): v is SceneTemplate => SCENE_TEMPLATES.includes(v as SceneTemplate);

function normalizeChart(raw: any): ChartSpec | undefined {
  const values = (Array.isArray(raw?.values) ? raw.values : []).map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n)).slice(0, 12);
  if (!values.length) return undefined;
  const kind = ['line', 'bar', 'pie'].includes(raw?.kind) ? raw.kind : 'bar';
  return { kind, values, labels: lines(raw?.labels, 12), label: str(raw?.label, 40) || undefined };
}
function normalizeFormula(raw: any): FormulaSpec | undefined {
  const body = str(raw?.body ?? raw?.tex, 90); if (!body) return undefined;
  const parts = (Array.isArray(raw?.parts) ? raw.parts : []).map((p: any) => ({ token: str(p?.token, 16), note: str(p?.note, 40) })).filter((p: FormulaPart) => p.token && p.note).slice(0, 4);
  return { body, parts: parts.length ? parts : undefined };
}

export function normalizeBeat(raw: any): Beat {
  const say = str(raw?.say ?? raw?.narration ?? raw?.voice, 160);
  const template = isTemplate(raw?.template) ? raw.template : 'bullets';
  const secs = Number(raw?.seconds);
  return {
    say, template,
    seconds: Number.isFinite(secs) && secs > 0 ? Math.min(MAX_BEAT, Math.max(0.4, Math.round(secs * 100) / 100)) : estimateSeconds(say),
    heading: str(raw?.heading, 40) || undefined,
    text: str(raw?.text, 120) || undefined,
    items: lines(raw?.items).length ? lines(raw?.items) : undefined,
    left: str(raw?.left, 80) || undefined, right: str(raw?.right, 80) || undefined,
    leftLabel: str(raw?.leftLabel, 16) || undefined, rightLabel: str(raw?.rightLabel, 16) || undefined,
    value: str(raw?.value, 16) || undefined, unit: str(raw?.unit, 12) || undefined,
    chart: normalizeChart(raw?.chart), formula: normalizeFormula(raw?.formula),
    mediaId: str(raw?.mediaId ?? raw?.media_id, 40) || undefined, caption: str(raw?.caption, 60) || undefined,
    source: str(raw?.source, 60) || undefined,
    emphasis: lines(raw?.emphasis, 4).length ? lines(raw?.emphasis, 4) : undefined,
    voiceId: str(raw?.voiceId ?? raw?.voice_id, 40) || undefined,
  };
}

export function normalizeSpec(raw: any): SceneSpec {
  const beats = (Array.isArray(raw?.beats) ? raw.beats : []).map(normalizeBeat).slice(0, 40);
  const fps = Number(raw?.fps);
  return {
    title: str(raw?.title, 60) || '未命名',
    no: Number.isFinite(Number(raw?.no)) ? Number(raw.no) : undefined,
    topic: str(raw?.topic, 60) || undefined,
    ratio: RATIOS.includes(raw?.ratio) ? raw.ratio : '9:16',
    fps: fps === 24 || fps === 25 || fps === 30 || fps === 60 ? fps : 30,
    theme: str(raw?.theme, 24) || 'ink',
    palette: raw?.palette && typeof raw.palette === 'object' ? Object.fromEntries(Object.entries(raw.palette).filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v as string)).map(([k, v]) => [k, v as string])) : undefined,
    watermark: str(raw?.watermark, 24) || undefined,
    progress: raw?.progress !== false,
    subtitle: raw?.subtitle !== false,
    music: str(raw?.music, 40) || undefined,
    musicVolume: Number.isFinite(Number(raw?.musicVolume)) ? Math.max(0, Math.min(1, Number(raw.musicVolume))) : undefined,
    source: str(raw?.source, 80) || undefined,
    beats,
  };
}

export function parseSpec(content: string): SceneSpec | null {
  try { const raw = JSON.parse(content || '{}'); if (!raw || typeof raw !== 'object') return null; return normalizeSpec(raw); } catch { return null; }
}

// ===== 时间轴 =====
export interface Slot { beat: Beat; index: number; start: number; end: number; }
export interface Timeline { slots: Slot[]; total: number; }

export function timelineOf(spec: SceneSpec): Timeline {
  let t = 0; const slots: Slot[] = [];
  spec.beats.forEach((beat, index) => { const end = t + beat.seconds; slots.push({ beat, index, start: t, end }); t = end; });
  return { slots, total: Math.round(t * 1000) / 1000 };
}
export function slotAt(tl: Timeline, t: number): Slot | null {
  if (!tl.slots.length) return null;
  return tl.slots.find(s => t >= s.start && t < s.end) || tl.slots[tl.slots.length - 1];
}
// 字幕：每句一条，起止就是这一段的起止（声画同源，不用另算）
export function subtitlesOf(spec: SceneSpec, tl = timelineOf(spec)): Subtitle[] {
  return tl.slots.filter(s => s.beat.say).map(s => ({ start: s.start, end: s.end, text: s.beat.say }));
}
// 画面里缺的东西：渲染前的自检，返回人话清单
// 一屏字幕之外的文字，观众要多久才读得完。
// 规则抄自 lemo-opuscar 的 readcheck（MIT）：汉字 4.5 字/秒、其他 15 字/秒，再加 1.5 秒的进出画余量，下限 1.5 秒。
// 和上游的差别：上游按「每一块文字各自计时」判，我们按整屏文字加起来算——因为读的人是顺着读下来的，
// 一屏四条要点不会四条同时读完。所以我们这条比上游严，过了我们的就一定能过它的。
export const CJK_CPS = 4.5, LATIN_CPS = 15, READ_PAD = 1.5;
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
export function beatTexts(b: Beat): string[] {
  const parts = [b.heading, b.text, b.left, b.right, b.leftLabel, b.rightLabel,
    b.value != null ? String(b.value) + (b.unit || '') : '', b.caption, b.source, b.formula?.body,
    ...(b.items || []), ...(b.chart?.labels || []), ...(b.formula?.parts || []).flatMap(p => [p.token, p.note])];
  return parts.map(x => String(x || '').trim()).filter(Boolean);
}
export function readingSeconds(b: Beat): number {
  let cjk = 0, other = 0;
  for (const text of beatTexts(b)) for (const ch of text) { if (/\s/.test(ch)) continue; CJK_RE.test(ch) ? cjk++ : other++; }
  if (!cjk && !other) return 0;                       // 纯画面没有字，不占阅读时间
  return Math.max(READ_PAD, cjk / CJK_CPS + other / LATIN_CPS + READ_PAD);
}

export function lintSpec(spec: SceneSpec): string[] {
  const out: string[] = [];
  if (!spec.beats.length) return ['画面方案里没有任何 beat'];
  spec.beats.forEach((b, i) => {
    const at = `第 ${i + 1} 段`;
    if (!b.say) out.push(`${at}没有口播（say），科普视频每一段都要有话`);
    if (b.say.length > 40) out.push(`${at}口播 ${b.say.length} 字，一句话超过 40 字就读不顺，拆成两段`);
    if (b.template === 'bullets' && !b.items?.length) out.push(`${at}用了 bullets 但没写 items`);
    if (b.template === 'steps' && (b.items?.length || 0) < 2) out.push(`${at}用了 steps 但步骤少于 2 条`);
    if (b.template === 'compare' && !(b.left && b.right)) out.push(`${at}用了 compare 但缺 left / right`);
    if (b.template === 'number' && !b.value) out.push(`${at}用了 number 但没写 value`);
    if (b.template === 'chart' && !b.chart) out.push(`${at}用了 chart 但没写 chart.values`);
    if (b.template === 'formula' && !b.formula) out.push(`${at}用了 formula 但没写 formula.body`);
    if (b.template === 'image' && !b.mediaId) out.push(`${at}用了 image 但没写 mediaId`);
    if (b.template === 'quote' && !b.text) out.push(`${at}用了 quote 但没写 text`);
    if ((b.items?.length || 0) > 4) out.push(`${at}列了 ${b.items!.length} 条，竖屏一屏最多 4 条`);
    // 画面上的字要来得及读完。配音写回时长之后这一条才准，所以配音前只当提醒。
    const need = readingSeconds(b);
    if (need > b.seconds + 0.05) out.push(`${at}画面上的字要 ${need.toFixed(1)} 秒才读得完，这一段只有 ${b.seconds.toFixed(1)} 秒：把字减少，或者把这句口播说长一点`);
  });
  const total = timelineOf(spec).total;
  if (total > 150) out.push(`全片 ${Math.round(total)} 秒，超过 150 秒就不是短视频了`);
  if (total < 15) out.push(`全片只有 ${Math.round(total)} 秒，太短`);
  const kinds = new Set(spec.beats.map(b => b.template));
  if (spec.beats.length >= 6 && kinds.size < 3) out.push('整条片子只用了不到 3 种画面模板，会像 PPT；换着用 hook / bullets / compare / number / chart');
  if (spec.beats[0] && spec.beats[0].template !== 'hook') out.push('第 1 段不是 hook：科普视频前 3 秒必须是钩子');
  return out;
}
