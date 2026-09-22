export function timeAgo(ts: number | undefined | null): string {
  if (!ts) return '刚刚';
  const d = Date.now() - ts;
  if (d < 60e3) return '刚刚';
  const m = Math.floor(d / 60e3); if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}小时前`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}天前`;
  const dt = new Date(ts); return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

export function clock(ts: number): string {
  const d = new Date(ts), n = new Date();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === n.toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

// 对话历史分组：今天 / 昨天 / 更早
export function dayGroup(ts: number): '今天' | '昨天' | '更早' {
  const d = new Date(ts), n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  if (ts >= start) return '今天';
  if (ts >= start - 864e5) return '昨天';
  return '更早';
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
