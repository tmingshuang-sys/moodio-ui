// 关键帧曲线：画面要做运镜、推拉、分段变速时，手写几个 easing 拼不出来，得有真正的关键帧插值。
// 移植自 lemo-opuscar 的 core/lib.js（MIT，Copyright (c) 2026 LemoLab），只取 paint.ts 里还没有的那几个，
// 改成 TypeScript 并补了注释与测试。paint.ts 自己的 E.* 缓动和 prng 保持不动，不要两套重复的东西。
//
// 为什么是单调三次插值（Fritsch–Carlson）而不是普通的 Catmull-Rom：后者在关键帧值起伏时会「冲过头」，
// 一个本该从 0 涨到 1 的推镜会先涨到 1.05 再回落，看起来像抖了一下。单调插值保证不越界。

export type Key = [number, number];

export function monotone(keys: Key[]): (t: number) => number {
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]);
  if (n === 0) return () => 0;
  if (n === 1) return () => ys[0];
  const d: number[] = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return t => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (t - xs[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

// 多维轨道：[[t, [x, y, scale]], …] → t => [x, y, scale]，一条机位轨道一个调用
export function track(keys: [number, number[]][]): (t: number) => number[] {
  if (!keys.length) return () => [];
  const dim = keys[0][1].length, fs: ((t: number) => number)[] = [];
  for (let j = 0; j < dim; j++) fs.push(monotone(keys.map(k => [k[0], k[1][j]] as Key)));
  return t => fs.map(f => f(t));
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// 弹簧落定：0 → 1，带一两下回弹。k 越大越快，z 越小回弹越多
export const spring = (t: number, k = 7, z = 0.35) => {
  const x = Math.max(0, t);
  return 1 - Math.exp(-z * k * x) * Math.cos(k * Math.sqrt(1 - z * z) * x * 1.6);
};

// 包络：在 [a, b] 区间里 0 → 1 → 0，两头各留一段淡入淡出
export const envelope = (t: number, a: number, b: number, fadeIn = 0.3, fadeOut = 0.3) =>
  Math.min(clamp01((t - a) / fadeIn), 1 - clamp01((t - (b - fadeOut)) / fadeOut));

// 一维值噪声：给缓慢的无规则漂移用（手持感、烛光），同一个 x 永远得到同一个值
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export const vnoise = (x: number) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i) + (hash(i + 1) - hash(i)) * u;
};
