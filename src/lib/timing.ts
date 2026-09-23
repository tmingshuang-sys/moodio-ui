// 模型一轮要等多久：把最近几次真实耗时记在本地，界面上显示「已用 12 秒 · 通常 40 秒」，等的人心里有数
// 只记文本模型那一轮（规划 / 写作 / 编译 / 看图），不含执行阶段的图片视频生成（那边按步骤各自有进度）
const KEY = 'moodio-timing-v1';
const KEEP = 8;                                   // 每类只留最近 8 次
const MIN = 1500, MAX = 15 * 60_000;              // 太短（报错 / 缓存）与太长（挂起）都不计进样本
// 还没有样本时的兜底预期：规划快、写整场剧本最慢
const DEFAULTS: Record<string, number> = { plan: 30_000, compile: 75_000, write: 90_000, vision: 25_000 };

type Store = Record<string, number[]>;
function read(): Store { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } }
function save(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 隐私模式下写不进去就算了 */ } }

export function recordRound(kind: string, ms: number) {
  if (!(ms >= MIN) || ms > MAX) return;
  const s = read(); s[kind] = [...(s[kind] || []), Math.round(ms)].slice(-KEEP); save(s);
}
// 预期耗时：样本够就取中位数，样本少就和兜底值各取一半，避免第一次特别快 / 特别慢就把预期带偏
export function expectedMs(kind: string): number {
  const base = DEFAULTS[kind] ?? DEFAULTS.plan;
  const list = (read()[kind] || []).slice().sort((a, b) => a - b);
  if (!list.length) return base;
  const median = list[Math.floor(list.length / 2)];
  return list.length >= 3 ? median : Math.round((median + base) / 2);
}
// 「45 秒」「1 分 20 秒」/ 英文 45s、1m 20s；预期值取整到 5 秒 / 10 秒，免得显示成「通常 37 秒」这种假精确
export function humanDuration(ms: number, en = false, round = false): string {
  let secs = Math.max(1, Math.round(ms / 1000));
  if (round) secs = secs < 60 ? Math.max(5, Math.round(secs / 5) * 5) : Math.round(secs / 10) * 10;
  if (secs < 60) return en ? `${secs}s` : `${secs} 秒`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (en) return s ? `${m}m ${s}s` : `${m}m`;
  return s ? `${m} 分 ${s} 秒` : `${m} 分钟`;
}
