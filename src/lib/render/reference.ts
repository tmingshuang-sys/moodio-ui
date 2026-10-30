// ===== 参考视频分析：把一条喜欢的片子拆成「配色 + 节奏 + 版式」，直接喂给渲染器 =====
// 「发一个参考视频，照着复刻」的可执行版本。复刻一条代码渲染的科普片，真正要抄的是三件事：
//   ① 配色（底色 / 字色 / 强调色）② 节奏（平均几秒一刀）③ 版式（竖横、字幕在哪一条带上）
// 这三件事都能直接从像素里算出来，不需要模型；模型只用来补「它为什么好看」这种说不清的部分。
// 这个文件里的数学部分是纯函数，可单测；取帧那部分要浏览器。
export interface Swatch { r: number; g: number; b: number; count: number; }
export interface RefPalette { bg: string; fg: string; accent: string; dark: boolean; }
export interface RefAnalysis {
  width: number; height: number; ratio: '9:16' | '16:9' | '1:1'; duration: number;
  palette: RefPalette; cuts: number[]; avgShot: number; textBand: 'bottom' | 'center' | 'none'; frames: number;
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
// 对比度按 WCAG 的相对亮度算，保证挑出来的字色在底色上读得清
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = (c: [number, number, number]) => 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  const l1 = L(a), l2 = L(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// 颜色量化：把像素按 32 级一档并桶，返回出现次数最多的若干桶（桶心取该桶里像素的均值）
export function quantize(pixels: Uint8ClampedArray, step = 32, top = 12): Swatch[] {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = (Math.floor(r / step) << 16) | (Math.floor(g / step) << 8) | Math.floor(b / step);
    const cur = buckets.get(key);
    if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.count++; }
    else buckets.set(key, { r, g, b, count: 1 });
  }
  return [...buckets.values()]
    .map(x => ({ r: x.r / x.count, g: x.g / x.count, b: x.b / x.count, count: x.count }))
    .sort((a, b) => b.count - a.count).slice(0, top);
}

// 从色板里挑出三个角色：底色取占比最大的；字色取与底色对比度最高的；强调色取「够鲜艳 + 够常见 + 在底色上读得清」的那个
export function rolesFrom(swatches: Swatch[]): RefPalette {
  if (!swatches.length) return { bg: '#f7f6f3', fg: '#1b1b1d', accent: '#c6341f', dark: false };
  const bg = swatches[0];
  const bgRgb: [number, number, number] = [bg.r, bg.g, bg.b];
  const dark = lum(bg.r, bg.g, bg.b) < 0.45;
  const scored = swatches.slice(1).map(s => ({ s, c: contrast(bgRgb, [s.r, s.g, s.b]), sat: sat(s.r, s.g, s.b) }));
  const fg = scored.slice().sort((a, b) => b.c - a.c)[0]?.s;
  // 强调色：对比度够读（≥ 3），饱和度最高；都不够鲜艳就按底色明暗给一个安全的
  const accent = scored.filter(x => x.c >= 3 && x.sat > 0.28).sort((a, b) => b.sat - a.sat)[0]?.s;
  return {
    bg: hex(bg.r, bg.g, bg.b),
    fg: fg ? hex(fg.r, fg.g, fg.b) : dark ? '#f2f3f5' : '#1b1b1d',
    accent: accent ? hex(accent.r, accent.g, accent.b) : dark ? '#49e08b' : '#c6341f',
    dark,
  };
}

// 切点：相邻采样帧的平均像素差超过阈值就算一刀。阈值按整条片子的差值分布定，暗片亮片都适用
export function detectCuts(diffs: number[], times: number[], k = 2.6): number[] {
  if (diffs.length < 3) return [];
  const sorted = diffs.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map(d => Math.abs(d - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 1;
  const thr = Math.max(median + k * mad, 10);
  const cuts: number[] = [];
  for (let i = 0; i < diffs.length; i++) {
    if (diffs[i] < thr) continue;
    // 切点是「一帧的尖峰」，动画是「连续几帧的高差值」：要求它比左右邻居都高，才不会把弹字、数字滚动当成切镜
    if (i > 0 && diffs[i] < diffs[i - 1]) continue;
    if (i < diffs.length - 1 && diffs[i] < diffs[i + 1]) continue;
    if (cuts.length && times[i] - cuts[cuts.length - 1] < 0.4) continue;   // 0.4 秒内不算两刀
    cuts.push(times[i]);
  }
  return cuts;
}

export function ratioOf(w: number, h: number): '9:16' | '16:9' | '1:1' {
  const r = w / Math.max(1, h);
  if (r < 0.85) return '9:16';
  if (r > 1.2) return '16:9';
  return '1:1';
}

// 字幕带：把画面横切成三条，看哪一条的「高对比细节」最多——字幕所在的那条会明显高于其它
export function textBandOf(bands: [number, number, number]): 'bottom' | 'center' | 'none' {
  const [top, center, bottom] = bands;
  const base = Math.max(1, (top + center + bottom) / 3);
  if (bottom > base * 1.45 && bottom > top) return 'bottom';
  if (center > base * 1.45) return 'center';
  return 'none';
}

// ---- 浏览器部分：取帧 ----
async function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = url; v.preload = 'auto'; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous';
    v.onloadedmetadata = () => resolve(v); v.onerror = () => reject(new Error('这个视频解不开，换一个格式试试'));
    v.load();
  });
}
const seek = (v: HTMLVideoElement, t: number) => new Promise<void>(resolve => { const done = () => { v.onseeked = null; resolve(); }; v.onseeked = done; v.currentTime = Math.min(t, Math.max(0, (v.duration || 1) - 0.05)); });

export interface AnalyzeOptions { onProgress?: (text: string, ratio: number) => void; signal?: AbortSignal; samples?: number; }

export async function analyzeReference(blob: Blob, opts: AnalyzeOptions = {}): Promise<RefAnalysis> {
  const url = URL.createObjectURL(blob);
  try {
    const v = await loadVideo(url);
    const duration = isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
    if (!duration) throw new Error('读不出这个视频的时长');
    const W = 96, H = Math.max(16, Math.round((v.videoHeight / Math.max(1, v.videoWidth)) * W));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    const n = Math.max(6, Math.min(opts.samples || 60, Math.round(duration * 2)));
    const all: number[] = []; const diffs: number[] = []; const times: number[] = [];
    const bands: [number, number, number] = [0, 0, 0];
    let prev: Uint8ClampedArray | null = null;
    const swatchPool: Uint8ClampedArray[] = [];
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new DOMException('已停止', 'AbortError');
      const t = (duration * i) / n;
      await seek(v, t);
      g.drawImage(v, 0, 0, W, H);
      const data = g.getImageData(0, 0, W, H).data;
      swatchPool.push(new Uint8ClampedArray(data));
      if (prev) {
        let sum = 0;
        for (let p = 0; p < data.length; p += 4) sum += Math.abs(data[p] - prev[p]) + Math.abs(data[p + 1] - prev[p + 1]) + Math.abs(data[p + 2] - prev[p + 2]);
        diffs.push(sum / (data.length / 4) / 3); times.push(t);
      }
      // 三条带各自的「相邻像素亮度跳变」总量：字幕那条会明显高
      for (let band = 0; band < 3; band++) {
        const y0 = Math.floor((H * band) / 3), y1 = Math.floor((H * (band + 1)) / 3);
        let edge = 0;
        for (let y = y0; y < y1; y++) for (let x = 1; x < W; x++) {
          const a = (y * W + x) * 4, b = a - 4;
          edge += Math.abs(lum(data[a], data[a + 1], data[a + 2]) - lum(data[b], data[b + 1], data[b + 2]));
        }
        bands[band] += edge;
      }
      prev = data;
      opts.onProgress?.(`分析参考视频 ${i + 1}/${n} 帧`, (i + 1) / n);
      all.push(t);
    }
    // 色板：把所有采样帧的像素并起来一次量化，得到整条片子的主色而不是某一帧的
    const merged = new Uint8ClampedArray(swatchPool.reduce((a, s) => a + s.length, 0));
    let at = 0; for (const s of swatchPool) { merged.set(s, at); at += s.length; }
    const palette = rolesFrom(quantize(merged));
    const cuts = detectCuts(diffs, times);
    return {
      width: v.videoWidth, height: v.videoHeight, ratio: ratioOf(v.videoWidth, v.videoHeight), duration,
      palette, cuts, avgShot: cuts.length > 1 ? Math.round((duration / (cuts.length + 1)) * 10) / 10 : Math.round(duration * 10) / 10,
      textBand: textBandOf(bands), frames: all.length,
    };
  } finally { URL.revokeObjectURL(url); }
}

// 取几张代表帧（均匀分布，避开片头片尾），转成 data URL 交给视觉模型看
export async function grabFrames(blob: Blob, count = 4, maxSide = 768): Promise<string[]> {
  const url = URL.createObjectURL(blob);
  try {
    const v = await loadVideo(url);
    const duration = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const r = Math.min(1, maxSide / Math.max(1, Math.max(v.videoWidth, v.videoHeight)));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(v.videoWidth * r)); c.height = Math.max(1, Math.round(v.videoHeight * r));
    const g = c.getContext('2d')!;
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      await seek(v, duration * ((i + 0.5) / count));
      g.drawImage(v, 0, 0, c.width, c.height);
      out.push(c.toDataURL('image/jpeg', 0.85));
    }
    return out;
  } finally { URL.revokeObjectURL(url); }
}

// 分析结果 → 可以直接写进画面方案的字段
export function styleFromAnalysis(a: RefAnalysis): { ratio: string; theme: string; palette: Record<string, string>; subtitle: boolean; pacing: number } {
  const p = a.palette;
  const mix = (c: string, t: string, k: number) => {
    const rgb = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    const [r1, g1, b1] = rgb(c), [r2, g2, b2] = rgb(t);
    return hex(r1 + (r2 - r1) * k, g1 + (g2 - g1) * k, b1 + (b2 - b1) * k);
  };
  return {
    ratio: a.ratio,
    theme: p.dark ? 'night' : 'ink',          // 先落到最接近的内置模板，再用 palette 覆盖具体颜色
    palette: {
      bg: p.bg, fg: p.fg, accent: p.accent,
      bg2: mix(p.bg, p.fg, 0.08),
      dim: mix(p.fg, p.bg, 0.45),
      line: mix(p.bg, p.fg, 0.16),
      accent2: mix(p.accent, p.fg, 0.4),
      sub: '#ffffff',
      subBg: p.dark ? 'rgba(0,0,0,0.6)' : 'rgba(22,22,24,0.82)',
    },
    subtitle: a.textBand !== 'none',
    pacing: Math.max(1.5, Math.min(8, a.avgShot)),
  };
}
