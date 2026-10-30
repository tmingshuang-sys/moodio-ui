// ===== 画帧：把画面方案的一个 beat 画到 canvas 上 =====
// 铁律（和逐帧导出配套）：画面只由时间 t 决定，不依赖累计量、不调 Math.random()。
// 这样任意时刻都能跳过去预览，逐帧导出也不会闪烁；要随机就用带种子的 PRNG。
// 模块里不做任何顶层副作用（噪声贴图等都懒加载），因为 tools.ts 链路会被 Node 里的单测 import。
import type { Beat, SceneSpec, Slot, Timeline } from './spec';
import { slotAt } from './spec';
import type { Layout, Theme } from './theme';
import { fitSize, subtitleLines, wrapText, type Measure } from './text';

export interface Stage {
  ctx: CanvasRenderingContext2D;
  spec: SceneSpec;
  tl: Timeline;
  layout: Layout;
  theme: Theme;
  measure: Measure;
  images: Map<string, ImageBitmap | HTMLImageElement>;
}

// ---------- 数学与缓动 ----------
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const prog = (x: number, a: number, b: number) => clamp01((x - a) / Math.max(1e-6, b - a));
export const E = {
  expoOut: (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  cubicOut: (x: number) => 1 - Math.pow(1 - x, 3),
  cubicInOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  backOut: (x: number, s = 1.7) => (x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)),
};
function prng(seed: number) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- 画布小工具 ----------
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath();
}
function setFont(s: Stage, size: number, weight = 700, family?: string) { s.ctx.font = `${weight} ${Math.round(size)}px ${family || s.theme.display}`; }
function text(s: Stage, str: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'alphabetic') {
  s.ctx.fillStyle = color; s.ctx.textAlign = align; s.ctx.textBaseline = base; s.ctx.fillText(str, x, y);
}
// 一组行：返回占用的总高度，方便上下居中
function block(s: Stage, lines: string[], x: number, y: number, size: number, lh: number, color: string, align: CanvasTextAlign = 'left') {
  lines.forEach((l, i) => text(s, l, x, y + i * lh + size * 0.78, color, align));
  return lines.length * lh;
}
const measurer = (s: Stage, weight = 700, family?: string): Measure => (str, size) => { setFont(s, size, weight, family); return s.ctx.measureText(str).width; };

// 噪声贴图：6 张 256×256，按帧轮换，颗粒不会随机闪
let grainTiles: HTMLCanvasElement[] | null = null;
function tiles(): HTMLCanvasElement[] {
  if (grainTiles) return grainTiles;
  grainTiles = [];
  for (let k = 0; k < 6; k++) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!; const img = g.createImageData(256, 256); const r = prng(900 + k);
    for (let i = 0; i < img.data.length; i += 4) { const v = 110 + r() * 145; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0); grainTiles.push(c);
  }
  return grainTiles;
}

// ---------- 全局层 ----------
function paintBackground(s: Stage) {
  const { ctx, layout: L, theme: th } = s;
  ctx.fillStyle = th.palette.bg; ctx.fillRect(0, 0, L.w, L.h);
}
function paintFinish(s: Stage, frame: number) {
  const { ctx, layout: L, theme: th } = s;
  if (th.grain > 0) {
    const t = tiles(); const r = prng(frame + 7);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = th.grain;
    ctx.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
    const pat = ctx.createPattern(t[frame % t.length], 'repeat');
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, L.w + 256, L.h + 256); }
    ctx.restore();
  }
  const v = ctx.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.42, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, L.w, L.h);
}

// 顶部：进度条 + 小标签 + 常驻标题（全屏类模板会把标题让出去）
const FULL_BLEED = new Set(['hook', 'title', 'endcard', 'image']);
function paintHeader(s: Stage, t: number, slot: Slot) {
  const { ctx, layout: L, theme: th, spec } = s;
  const k = s.tl.total > 0 ? clamp01(t / s.tl.total) : 0;
  if (spec.progress) {
    const y = L.headTop - 36, x = L.pad, w = L.w - L.pad * 2;
    ctx.fillStyle = th.palette.line; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = th.palette.accent; ctx.fillRect(x, y, w * k, 6);
  }
  const label = [spec.no ? `第 ${String(spec.no).padStart(2, '0')} 讲` : '', spec.topic || ''].filter(Boolean).join(' · ');
  if (label) { setFont(s, 30 * L.scale, 600); text(s, label, L.pad, L.headTop + 14, th.palette.dim); }
  if (!FULL_BLEED.has(slot.beat.template) && spec.title) {
    const m = measurer(s, 800);
    // 常驻标题只是「这条片子叫什么」，比段落小标题低一档，不然两行大字打架
    const { size, lines } = fitSize(spec.title, L.w - L.pad * 2, 2, m, 58 * L.scale, 34);
    setFont(s, size, 800);
    block(s, lines, L.pad, L.headTop + 50, size, size * 1.22, th.palette.fg);
  }
}

// 字幕：底条 + 最多两行，重点词用强调色
function paintSubtitle(s: Stage, slot: Slot, local: number) {
  const { ctx, layout: L, theme: th } = s;
  const say = slot.beat.say; if (!s.spec.subtitle || !say) return;
  const size = 50 * L.scale, m = measurer(s, 700);
  const lines = subtitleLines(say, size, L.w - L.pad * 2 - 40, m);
  const lh = size * 1.34, h = lines.length * lh + 34, w = L.w - L.pad * 2;
  const alpha = Math.min(prog(local, 0, 0.12), 1);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = th.palette.subBg; roundRect(ctx, L.pad, s.layout.subY - h / 2, w, h, 16); ctx.fill();
  setFont(s, size, 700);
  const em = slot.beat.emphasis || [];
  lines.forEach((line, i) => {
    const y = s.layout.subY - h / 2 + 17 + i * lh + size * 0.78;
    const hit = em.find(e => e && line.includes(e));
    if (!hit) { text(s, line, L.w / 2, y, th.palette.sub, 'center'); return; }
    // 把重点词单独上色：按「前 / 词 / 后」三段量宽，整体仍居中
    const at = line.indexOf(hit), a = line.slice(0, at), b = line.slice(at + hit.length);
    const wa = ctx.measureText(a).width, wh = ctx.measureText(hit).width, wb = ctx.measureText(b).width;
    let x = L.w / 2 - (wa + wh + wb) / 2;
    text(s, a, x, y, th.palette.sub); x += wa;
    text(s, hit, x, y, th.palette.accent); x += wh;
    text(s, b, x, y, th.palette.sub);
  });
  ctx.restore();
}

function paintWatermark(s: Stage) {
  const { layout: L, theme: th, spec } = s;
  if (!spec.watermark) return;
  setFont(s, 26 * L.scale, 600);
  s.ctx.globalAlpha = 0.5; text(s, spec.watermark, L.w - L.pad, L.h - 42, th.palette.dim, 'right'); s.ctx.globalAlpha = 1;
}

// 段界白闪：每段开头 0.12 秒一道很淡的闪，节奏感来自这里（硬切之外不另加转场）
function paintCut(s: Stage, local: number) {
  const a = (1 - prog(local, 0, 0.14)) * 0.22;
  if (a <= 0.004) return;
  s.ctx.save(); s.ctx.globalCompositeOperation = 'lighter'; s.ctx.globalAlpha = a;
  s.ctx.fillStyle = '#ffffff'; s.ctx.fillRect(0, 0, s.layout.w, s.layout.h); s.ctx.restore();
}

// ---------- 模板 ----------
type Painter = (s: Stage, b: Beat, local: number, dur: number) => void;

// 主舞台里把一块内容垂直居中：先量总高，再定起始 y。不居中的话竖屏上半屏挤满、下半屏全空
function centered(s: Stage, h: number) { const st = s.layout.stage; return st.y + Math.max(0, (st.h - h) / 2); }
// 把文字缩到一行放得下：返回可用的字号
function shrinkToWidth(s: Stage, str: string, maxWidth: number, size: number, weight = 900, family?: string) {
  setFont(s, size, weight, family);
  const w = s.ctx.measureText(str).width;
  return w <= maxWidth ? size : Math.max(24, Math.floor(size * (maxWidth / w)));
}

// 要点逐条出现的时刻：留出收尾时间，最多每 0.55 秒一条
function stepTimes(n: number, dur: number): number[] {
  const usable = Math.max(0.4, dur - 0.5);
  const step = Math.min(0.55, usable / Math.max(1, n));
  return Array.from({ length: n }, (_, i) => 0.18 + i * step);
}

const hook: Painter = (s, b, local) => {
  const { layout: L, theme: th } = s;
  const body = b.text || b.heading || b.say;
  const m = measurer(s, 900);
  const { size, lines } = fitSize(body, L.w - L.pad * 2, 4, m, 150 * L.scale, 56);
  const k = E.expoOut(prog(local, 0, 0.5));
  const lh = size * 1.2, h = lines.length * lh;
  s.ctx.save(); s.ctx.globalAlpha = Math.min(1, k * 1.2);
  s.ctx.translate(0, (1 - k) * 46);
  setFont(s, size, 900);
  block(s, lines, L.w / 2, L.h * 0.38 - h / 2, size, lh, th.palette.fg, 'center');
  // 大字下面扫出一道强调色横线
  const sw = E.cubicOut(prog(local, 0.3, 0.85));
  const lw = Math.min(L.w - L.pad * 2, size * 4.2);
  s.ctx.fillStyle = th.palette.accent;
  s.ctx.fillRect(L.w / 2 - (lw * sw) / 2, L.h * 0.38 + h / 2 + 30, lw * sw, 12);
  s.ctx.restore();
};

const title: Painter = (s, b, local) => {
  const { layout: L, theme: th } = s;
  const k = E.expoOut(prog(local, 0, 0.45));
  const m = measurer(s, 900);
  const tag = b.heading || s.spec.topic || '';
  const body = b.text || s.spec.title;
  const { size, lines } = fitSize(body, L.w - L.pad * 2, 3, m, 120 * L.scale, 52);
  const lh = size * 1.2, h = lines.length * lh;
  const cy = L.h * 0.42;
  s.ctx.save(); s.ctx.globalAlpha = k;
  if (tag) { setFont(s, 36 * L.scale, 700); text(s, tag, L.pad, cy - h / 2 - 54, th.palette.accent); }
  setFont(s, size, 900);
  block(s, lines, L.pad + (1 - k) * 28, cy - h / 2, size, lh, th.palette.fg);
  s.ctx.fillStyle = th.palette.line;
  s.ctx.fillRect(L.pad, cy + h / 2 + 44, (L.w - L.pad * 2) * E.cubicOut(prog(local, 0.2, 0.9)), 4);
  s.ctx.restore();
};

const bullets: Painter = (s, b, local, dur) => {
  const { theme: th, layout: L, layout } = s;
  const items = b.items || [];
  const size = Math.max(40, Math.min(62, 62 - items.length * 3)) * L.scale;
  const m = measurer(s, 600);
  // 先量：标题几行、每条几行，算出整块高度，再垂直居中画
  const head = b.heading ? fitSize(b.heading, layout.stage.w, 2, measurer(s, 800), 76 * L.scale, 42) : null;
  const wrapped = items.map(it => wrapText(it, size, layout.stage.w - 74, m, 3));
  const headH = head ? head.lines.length * head.size * 1.2 + 46 : 0;
  const total = headH + wrapped.reduce((a, l) => a + l.length * size * 1.3 + 30, 0);
  let y = centered(s, total);
  if (head) { setFont(s, head.size, 800); block(s, head.lines, layout.stage.x, y, head.size, head.size * 1.2, th.palette.fg); y += headH; }
  const times = stepTimes(items.length, dur);
  wrapped.forEach((lines, i) => {
    const k = E.expoOut(prog(local, times[i], times[i] + 0.4));
    if (k > 0.001) {
      s.ctx.save(); s.ctx.globalAlpha = k; s.ctx.translate((1 - k) * 34, 0);
      s.ctx.fillStyle = th.palette.accent;
      roundRect(s.ctx, layout.stage.x, y + size * 0.22, 14, size * 0.86, 7); s.ctx.fill();
      setFont(s, size, 600);
      block(s, lines, layout.stage.x + 44, y, size, size * 1.3, th.palette.fg);
      s.ctx.restore();
    }
    y += lines.length * size * 1.3 + 30;
  });
};

const term: Painter = (s, b, local) => {
  const { layout: L, theme: th, layout } = s;
  const k = E.backOut(prog(local, 0, 0.5));
  const name = b.heading || b.text || b.say;
  const desc = b.heading ? b.text || '' : '';
  const fit = fitSize(name, layout.stage.w - 80, 2, measurer(s, 900), 104 * L.scale, 48);
  const boxH = fit.lines.length * fit.size * 1.2 + 70;
  const d = desc ? fitSize(desc, layout.stage.w - 20, 4, measurer(s, 500), 54 * L.scale, 34) : null;
  const descH = d ? d.lines.length * d.size * 1.36 + 44 : 0;
  const top = centered(s, boxH + descH);
  const cy = top + boxH / 2;
  s.ctx.save();
  s.ctx.translate(L.w / 2, cy); s.ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k); s.ctx.translate(-L.w / 2, -cy);
  s.ctx.globalAlpha = Math.min(1, k);
  s.ctx.fillStyle = th.palette.bg2;
  roundRect(s.ctx, layout.stage.x, top, layout.stage.w, boxH, 26); s.ctx.fill();
  s.ctx.strokeStyle = th.palette.accent; s.ctx.lineWidth = 6;
  s.ctx.beginPath(); s.ctx.moveTo(layout.stage.x + 26, top + 6); s.ctx.lineTo(layout.stage.x + 26, top + boxH - 6); s.ctx.stroke();
  setFont(s, fit.size, 900);
  block(s, fit.lines, L.w / 2, top + 35, fit.size, fit.size * 1.2, th.palette.fg, 'center');
  s.ctx.restore();
  if (d) {
    s.ctx.save(); s.ctx.globalAlpha = E.expoOut(prog(local, 0.35, 0.8)); setFont(s, d.size, 500);
    block(s, d.lines, L.w / 2, top + boxH + 44, d.size, d.size * 1.36, th.palette.dim, 'center');
    s.ctx.restore();
  }
};

const compare: Painter = (s, b, local) => {
  const { theme: th, layout, layout: L } = s;
  const vertical = s.spec.ratio === '9:16';
  const gap = 28;
  const cells = [
    { label: b.leftLabel || '以前', body: b.left || '', color: th.palette.accent2, at: 0.1 },
    { label: b.rightLabel || '现在', body: b.right || '', color: th.palette.accent, at: 0.45 },
  ];
  cells.forEach((c, i) => {
    const k = E.expoOut(prog(local, c.at, c.at + 0.45));
    if (k <= 0.001) return;
    const w = vertical ? layout.stage.w : (layout.stage.w - gap) / 2;
    const h = vertical ? (layout.stage.h - gap) / 2 : layout.stage.h;
    const x = vertical ? layout.stage.x : layout.stage.x + i * (w + gap);
    const y = vertical ? layout.stage.y + i * (h + gap) : layout.stage.y;
    s.ctx.save(); s.ctx.globalAlpha = k; s.ctx.translate(vertical ? 0 : (1 - k) * 30 * (i ? 1 : -1), vertical ? (1 - k) * 30 : 0);
    s.ctx.fillStyle = th.palette.bg2; roundRect(s.ctx, x, y, w, h, 26); s.ctx.fill();
    s.ctx.fillStyle = c.color; roundRect(s.ctx, x, y, w, 10, 5); s.ctx.fill();
    setFont(s, 36 * L.scale, 800); text(s, c.label, x + 34, y + 68, c.color);
    const fit = fitSize(c.body, w - 68, 4, measurer(s, 600), 58 * L.scale, 32);
    setFont(s, fit.size, 600);
    block(s, fit.lines, x + 34, y + h / 2 - (fit.lines.length * fit.size * 1.32) / 2 + 20, fit.size, fit.size * 1.32, th.palette.fg);
    s.ctx.restore();
  });
};

const number: Painter = (s, b, local) => {
  const { theme: th, layout, layout: L } = s;
  const raw = b.value || '';
  const num = Number(raw.replace(/[^\d.-]/g, ''));
  const k = E.cubicOut(prog(local, 0.05, 0.75));
  // 纯数字就做滚动增长（科普视频里数字自己跳上去比静止的数字有劲），带单位或符号的原样显示
  const shown = Number.isFinite(num) && Math.abs(num) >= 1 && /^[\d.,\s-]+$/.test(raw)
    ? (Math.round(num * k * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: raw.includes('.') ? 1 : 0 })
    : raw;
  const avail = layout.stage.w;
  let size = shrinkToWidth(s, shown, avail * (b.unit ? 0.72 : 0.96), 240 * L.scale);
  setFont(s, size, 900); const wNum = s.ctx.measureText(shown).width;
  const unitSize = Math.round(size * 0.34);
  setFont(s, unitSize, 800); const wUnit = b.unit ? s.ctx.measureText(b.unit).width + 18 : 0;
  const fit = b.text ? fitSize(b.text, layout.stage.w, 3, measurer(s, 600), 60 * L.scale, 34) : null;
  const noteH = fit ? fit.lines.length * fit.size * 1.32 + 50 : 0;
  const top = centered(s, size * 1.1 + noteH);
  const cy = top + size * 0.55;
  const x0 = L.w / 2 - (wNum + wUnit) / 2;
  setFont(s, size, 900); text(s, shown, x0, cy, th.palette.accent, 'left', 'middle');
  if (b.unit) { setFont(s, unitSize, 800); text(s, b.unit, x0 + wNum + 18, cy + size * 0.3, th.palette.dim, 'left', 'alphabetic'); }
  if (fit) {
    s.ctx.save(); s.ctx.globalAlpha = E.expoOut(prog(local, 0.4, 0.9)); setFont(s, fit.size, 600);
    block(s, fit.lines, L.w / 2, top + size * 1.1 + 20, fit.size, fit.size * 1.32, th.palette.fg, 'center');
    s.ctx.restore();
  }
};

const steps: Painter = (s, b, local, dur) => {
  const { theme: th, layout, layout: L } = s;
  const items = (b.items || []).slice(0, 4);
  const times = stepTimes(items.length, dur);
  const size = 50 * L.scale, r = 42 * L.scale, m = measurer(s, 600);
  const head = b.heading ? fitSize(b.heading, layout.stage.w, 1, measurer(s, 800), 66 * L.scale, 40) : null;
  const wrapped = items.map(it => wrapText(it, size, layout.stage.w - r * 2 - 50, m, 2));
  const rowH = wrapped.map(l => Math.max(r * 2 + 30, l.length * size * 1.28 + 30));
  const headH = head ? head.size * 1.3 + 40 : 0;
  const top = centered(s, headH + rowH.reduce((a, h) => a + h, 0));
  let y = top;
  if (head) { setFont(s, head.size, 800); text(s, head.lines[0], layout.stage.x, y + head.size * 0.8, th.palette.fg); y += headH; }
  wrapped.forEach((lines, i) => {
    const k = E.backOut(prog(local, times[i], times[i] + 0.42));
    const cy = y + rowH[i] / 2;
    if (k > 0.001) {
      s.ctx.save(); s.ctx.globalAlpha = Math.min(1, k);
      s.ctx.fillStyle = th.palette.accent; s.ctx.beginPath(); s.ctx.arc(layout.stage.x + r, cy, r * Math.min(1, k), 0, Math.PI * 2); s.ctx.fill();
      setFont(s, r * 1.05, 900); text(s, String(i + 1), layout.stage.x + r, cy + 2, th.palette.bg, 'center', 'middle');
      setFont(s, size, 600);
      block(s, lines, layout.stage.x + r * 2 + 34, cy - (lines.length * size * 1.28) / 2, size, size * 1.28, th.palette.fg);
      if (i < items.length - 1) {
        const k2 = E.cubicOut(prog(local, times[i] + 0.2, times[i] + 0.6));
        s.ctx.strokeStyle = th.palette.line; s.ctx.lineWidth = 5;
        s.ctx.beginPath(); s.ctx.moveTo(layout.stage.x + r, cy + r + 8); s.ctx.lineTo(layout.stage.x + r, cy + r + 8 + (rowH[i] / 2 - r + 14) * k2); s.ctx.stroke();
      }
      s.ctx.restore();
    }
    y += rowH[i];
  });
};

const chart: Painter = (s, b, local) => {
  const { theme: th, layout, layout: L } = s;
  const c = b.chart!; const vals = c.values;
  const max = Math.max(...vals.map(Math.abs), 1);
  const k = E.cubicOut(prog(local, 0.1, 0.9));
  const head = b.heading ? fitSize(b.heading, layout.stage.w, 1, measurer(s, 800), 62 * L.scale, 38) : null;
  const headH = head ? head.size * 1.3 + 44 : 0;
  const boxH = Math.min(layout.stage.h - headH - 70, 640 * L.scale);
  const top = centered(s, headH + boxH + 60);
  if (head) { setFont(s, head.size, 800); text(s, head.lines[0], layout.stage.x, top + head.size * 0.8, th.palette.fg); }
  const box = { x: layout.stage.x, y: top + headH, w: layout.stage.w, h: boxH };
  s.ctx.strokeStyle = th.palette.line; s.ctx.lineWidth = 3;
  if (c.kind !== 'pie') { s.ctx.beginPath(); s.ctx.moveTo(box.x, box.y + box.h); s.ctx.lineTo(box.x + box.w, box.y + box.h); s.ctx.stroke(); }
  if (c.kind === 'bar') {
    const n = vals.length, gap = 24 * L.scale, bw = (box.w - gap * (n - 1)) / n;
    vals.forEach((v, i) => {
      const kk = E.expoOut(prog(local, 0.1 + i * 0.08, 0.1 + i * 0.08 + 0.5));
      const h = (Math.abs(v) / max) * (box.h - 60) * kk;
      const x = box.x + i * (bw + gap);
      s.ctx.fillStyle = i === n - 1 ? th.palette.accent : th.palette.accent2;
      roundRect(s.ctx, x, box.y + box.h - h, bw, h, 10); s.ctx.fill();
      if (kk > 0.6) { setFont(s, 34 * L.scale, 700); text(s, String(v), x + bw / 2, box.y + box.h - h - 18, th.palette.fg, 'center'); }
      if (c.labels?.[i]) { const ls = shrinkToWidth(s, c.labels[i], bw, 30 * L.scale, 600); setFont(s, ls, 600); text(s, c.labels[i], x + bw / 2, box.y + box.h + 46, th.palette.dim, 'center'); }
    });
  } else if (c.kind === 'line') {
    const n = vals.length;
    const px = (i: number) => box.x + (box.w * i) / Math.max(1, n - 1);
    const py = (v: number) => box.y + box.h - 20 - (Math.abs(v) / max) * (box.h - 70);
    const shown = Math.max(1, Math.ceil(n * k));
    s.ctx.strokeStyle = th.palette.accent; s.ctx.lineWidth = 8; s.ctx.lineJoin = 'round'; s.ctx.lineCap = 'round';
    s.ctx.beginPath();
    for (let i = 0; i < shown; i++) { const x = px(i), y = py(vals[i]); i ? s.ctx.lineTo(x, y) : s.ctx.moveTo(x, y); }
    s.ctx.stroke();
    s.ctx.fillStyle = th.palette.accent;
    for (let i = 0; i < shown; i++) { s.ctx.beginPath(); s.ctx.arc(px(i), py(vals[i]), 10, 0, Math.PI * 2); s.ctx.fill(); }
    if (c.labels?.length) { setFont(s, 30 * L.scale, 600); c.labels.slice(0, n).forEach((lb, i) => text(s, lb, px(i), box.y + box.h + 46, th.palette.dim, 'center')); }
  } else {
    const total = vals.reduce((a, v) => a + Math.abs(v), 0) || 1;
    const r = Math.min(box.w, box.h) * 0.42, cx = L.w / 2, cy = box.y + box.h / 2;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const span = (Math.abs(v) / total) * Math.PI * 2 * k;
      s.ctx.fillStyle = i === 0 ? th.palette.accent : i === 1 ? th.palette.accent2 : th.palette.line;
      s.ctx.beginPath(); s.ctx.moveTo(cx, cy); s.ctx.arc(cx, cy, r, a0, a0 + span); s.ctx.closePath(); s.ctx.fill();
      a0 += span;
    });
    s.ctx.fillStyle = th.palette.bg; s.ctx.beginPath(); s.ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2); s.ctx.fill();
    setFont(s, 64 * L.scale, 900);
    text(s, `${Math.round((Math.abs(vals[0]) / total) * 100 * k)}%`, cx, cy + 4, th.palette.fg, 'center', 'middle');
  }
  if (c.label) { setFont(s, 32 * L.scale, 600); text(s, c.label, box.x + box.w, box.y - 18, th.palette.dim, 'right'); }
};

const formula: Painter = (s, b, local, dur) => {
  const { theme: th, layout, layout: L } = s;
  const f = b.formula!;
  const k = E.expoOut(prog(local, 0, 0.45));
  const fit = fitSize(f.body, layout.stage.w - 60, 2, measurer(s, 700, th.mono), 104 * L.scale, 40);
  const bodyH = fit.lines.length * fit.size * 1.3 + 76;
  const parts = f.parts || [];
  const partH = 78 * L.scale;
  const top = centered(s, bodyH + parts.length * partH + (parts.length ? 30 : 0));
  s.ctx.save(); s.ctx.globalAlpha = k;
  s.ctx.fillStyle = th.palette.bg2; roundRect(s.ctx, layout.stage.x, top, layout.stage.w, bodyH, 24); s.ctx.fill();
  setFont(s, fit.size, 700, th.mono);
  block(s, fit.lines, L.w / 2, top + 38, fit.size, fit.size * 1.3, th.palette.fg, 'center');
  s.ctx.restore();
  const times = stepTimes(parts.length, dur);
  let y = top + bodyH + 30;
  parts.forEach((p, i) => {
    const kk = E.expoOut(prog(local, times[i], times[i] + 0.4));
    if (kk > 0.001) {
      s.ctx.save(); s.ctx.globalAlpha = kk; s.ctx.translate((1 - kk) * 26, 0);
      setFont(s, 52 * L.scale, 800, th.mono);
      text(s, p.token, layout.stage.x, y + 46, th.palette.accent);
      const tw = s.ctx.measureText(p.token).width;
      const ns = 42 * L.scale;
      setFont(s, ns, 500);
      block(s, wrapText(p.note, ns, layout.stage.w - tw - 60, measurer(s, 500), 1), layout.stage.x + tw + 28, y, ns, ns * 1.3, th.palette.dim);
      s.ctx.restore();
    }
    y += partH;
  });
};

const quote: Painter = (s, b, local) => {
  const { theme: th, layout } = s;
  const k = E.expoOut(prog(local, 0, 0.5));
  const fit = fitSize(b.text || b.say, layout.stage.w - 60, 6, measurer(s, 600), 66 * s.layout.scale, 34);
  const h = fit.lines.length * fit.size * 1.38;
  const top = centered(s, h + (b.source ? 90 : 0));
  s.ctx.save(); s.ctx.globalAlpha = k;
  setFont(s, 160 * s.layout.scale, 900);
  s.ctx.globalAlpha = k * 0.18; text(s, '\u201c', layout.stage.x - 6, top + 40, th.palette.accent); s.ctx.globalAlpha = k;
  setFont(s, fit.size, 600);
  block(s, fit.lines, layout.stage.x + 30, top, fit.size, fit.size * 1.38, th.palette.fg);
  if (b.source) { setFont(s, 34 * s.layout.scale, 600); text(s, '\u2014 ' + b.source, layout.stage.x + 30, top + h + 56, th.palette.dim); }
  s.ctx.restore();
};

const image: Painter = (s, b, local, dur) => {
  const { theme: th, layout: L } = s;
  const img = b.mediaId ? s.images.get(b.mediaId) : null;
  const box = { x: 0, y: 0, w: L.w, h: L.h };
  if (img) {
    const iw = (img as any).width || 1, ih = (img as any).height || 1;
    const zoom = 1.04 + 0.08 * (local / Math.max(0.1, dur));           // 慢推（Ken Burns）
    const scale = Math.max(box.w / iw, box.h / ih) * zoom;
    const w = iw * scale, h = ih * scale;
    s.ctx.drawImage(img as any, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    const g = s.ctx.createLinearGradient(0, L.h * 0.45, 0, L.h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
    s.ctx.fillStyle = g; s.ctx.fillRect(0, L.h * 0.45, L.w, L.h * 0.55);
  } else {
    s.ctx.fillStyle = th.palette.bg2; s.ctx.fillRect(box.x, box.y, box.w, box.h);
    setFont(s, 44 * L.scale, 600); text(s, '（这一段缺图片素材）', L.w / 2, L.h / 2, th.palette.dim, 'center', 'middle');
  }
  if (b.caption) {
    const k = E.expoOut(prog(local, 0.2, 0.7));
    s.ctx.save(); s.ctx.globalAlpha = k;
    setFont(s, 44 * L.scale, 700);
    text(s, b.caption, L.pad, s.layout.subY - 150, img ? '#ffffff' : th.palette.fg);
    s.ctx.restore();
  }
};

const diagram: Painter = (s, b, local, dur) => {
  const { theme: th, layout, layout: L } = s;
  const nodes = (b.items || []).slice(0, 5);
  const times = stepTimes(nodes.length, dur);
  const m = measurer(s, 700);
  let top = layout.stage.y;
  if (b.heading) { setFont(s, 62 * L.scale, 800); text(s, b.heading, layout.stage.x, top + 48, th.palette.fg); top += 100; }
  const cellH = (layout.stage.h - (top - layout.stage.y)) / Math.max(1, nodes.length);
  nodes.forEach((n, i) => {
    const k = E.backOut(prog(local, times[i], times[i] + 0.4));
    if (k <= 0.001) return;
    const size = 46 * L.scale;
    const lines = wrapText(n, size, layout.stage.w - 120, m, 2);
    const boxH = lines.length * size * 1.3 + 44;
    const y = top + i * cellH + (cellH - boxH) / 2;
    s.ctx.save(); s.ctx.globalAlpha = Math.min(1, k);
    s.ctx.translate(L.w / 2, y + boxH / 2); s.ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); s.ctx.translate(-L.w / 2, -(y + boxH / 2));
    s.ctx.fillStyle = i === nodes.length - 1 ? th.palette.accent : th.palette.bg2;
    roundRect(s.ctx, layout.stage.x + 40, y, layout.stage.w - 80, boxH, 18); s.ctx.fill();
    setFont(s, size, 700);
    block(s, lines, L.w / 2, y + 22, size, size * 1.3, i === nodes.length - 1 ? th.palette.bg : th.palette.fg, 'center');
    s.ctx.restore();
    if (i < nodes.length - 1) {
      const k2 = E.cubicOut(prog(local, times[i] + 0.22, times[i] + 0.55));
      if (k2 > 0.01) {
        const y0 = y + boxH + 6, len = (cellH - boxH - 12) * k2;
        s.ctx.strokeStyle = th.palette.line; s.ctx.lineWidth = 6; s.ctx.lineCap = 'round';
        s.ctx.beginPath(); s.ctx.moveTo(L.w / 2, y0); s.ctx.lineTo(L.w / 2, y0 + len); s.ctx.stroke();
        if (k2 > 0.85) {   // 箭头
          s.ctx.fillStyle = th.palette.line; s.ctx.beginPath();
          s.ctx.moveTo(L.w / 2, y0 + len + 12); s.ctx.lineTo(L.w / 2 - 12, y0 + len - 6); s.ctx.lineTo(L.w / 2 + 12, y0 + len - 6); s.ctx.closePath(); s.ctx.fill();
        }
      }
    }
  });
};

const endcard: Painter = (s, b, local) => {
  const { theme: th, layout: L } = s;
  const k = E.expoOut(prog(local, 0, 0.5));
  const line = b.text || b.heading || b.say;
  const m = measurer(s, 900);
  const fit = fitSize(line, L.w - L.pad * 2, 3, m, 108 * L.scale, 46);
  const cy = L.h * 0.42;
  s.ctx.save(); s.ctx.globalAlpha = k;
  setFont(s, fit.size, 900);
  block(s, fit.lines, L.w / 2, cy - (fit.lines.length * fit.size * 1.2) / 2, fit.size, fit.size * 1.2, th.palette.fg, 'center');
  s.ctx.fillStyle = th.palette.accent;
  const lw = Math.min(L.w - L.pad * 2, 420);
  s.ctx.fillRect(L.w / 2 - (lw * E.cubicOut(prog(local, 0.25, 0.8))) / 2, cy + (fit.lines.length * fit.size * 1.2) / 2 + 36, lw * E.cubicOut(prog(local, 0.25, 0.8)), 10);
  if (s.spec.source) {
    setFont(s, 30 * L.scale, 500);
    text(s, '素材出处：' + s.spec.source, L.w / 2, cy + (fit.lines.length * fit.size * 1.2) / 2 + 110, th.palette.dim, 'center');
  }
  s.ctx.restore();
};

export const PAINTERS: Record<string, Painter> = { hook, title, bullets, term, compare, number, steps, chart, formula, quote, image, diagram, endcard };

// ---------- 一帧 ----------
export function drawFrame(s: Stage, t: number, frame = Math.round(t * s.spec.fps)) {
  paintBackground(s);
  const slot = slotAt(s.tl, t);
  if (!slot) { paintFinish(s, frame); return; }
  const local = t - slot.start, dur = slot.end - slot.start;
  paintHeader(s, t, slot);
  const painter = PAINTERS[slot.beat.template] || bullets;
  s.ctx.save();
  try { painter(s, slot.beat, local, dur); } finally { s.ctx.restore(); }
  paintSubtitle(s, slot, local);
  paintWatermark(s);
  paintCut(s, local);
  paintFinish(s, frame);
}
