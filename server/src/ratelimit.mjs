// 限流：只用来挡暴力猜口令。
//
// 关键设计：**只对「猜错了」计数，不对正常请求计数**。
// 对所有请求限流听起来更稳，实际上很容易误伤——视频生成要每隔一两秒轮询一次任务状态，
// 一次成片几百个请求是正常的。而暴力破解的特征恰恰是「大量失败」，所以按失败计数既挡得住，
// 又不可能影响正常使用：你只要口令是对的，限流器根本不会看见你。
//
// 内存实现，进程重启就清零。够用：它防的是持续猜解，不是分布式攻击；
// 真要防后者得上 Redis + 更前面的一层，不是现在这个规模该操心的。
const BUCKETS = new Map();          // key → { hits: number[], blockedUntil: number }
const MAX_KEYS = 10_000;            // 防止被海量不同 key 撑爆内存

export function createLimiter({ limit, windowMs, blockMs, now = Date.now }) {
  const name = `${limit}/${windowMs}ms`;
  return {
    // 记一次失败。返回 true 表示「从现在起该挡了」
    fail(key) {
      const k = name + '|' + key;
      let b = BUCKETS.get(k);
      if (!b) {
        if (BUCKETS.size >= MAX_KEYS) sweep(now());
        b = { hits: [], blockedUntil: 0 };
        BUCKETS.set(k, b);
      }
      const t = now();
      b.hits = b.hits.filter(x => t - x < windowMs);
      b.hits.push(t);
      if (b.hits.length >= limit) { b.blockedUntil = t + blockMs; b.hits = []; }
      return b.blockedUntil > t;
    },
    // 还要等多少秒才能再试；0 表示现在可以
    retryAfter(key) {
      const b = BUCKETS.get(name + '|' + key);
      if (!b) return 0;
      const left = b.blockedUntil - now();
      return left > 0 ? Math.ceil(left / 1000) : 0;
    },
    // 成功一次就清掉这个 key 的失败记录——密码记错一次不该留下痕迹
    clear(key) { BUCKETS.delete(name + '|' + key); },
  };
}

function sweep(t) {
  for (const [k, b] of BUCKETS) {
    if (b.blockedUntil < t && !b.hits.some(x => t - x < 3600_000)) BUCKETS.delete(k);
  }
  // 扫完还是满的就整个清掉：宁可放过一阵，也不要因为限流器本身把进程撑爆
  if (BUCKETS.size >= MAX_KEYS) BUCKETS.clear();
}

export const __reset = () => BUCKETS.clear();
export const __size = () => BUCKETS.size;

// 请求是谁发来的。线上在 Caddy 后面，socket 地址永远是 127.0.0.1，真实 IP 在 X-Forwarded-For 里。
// **取最后一个**：Caddy 是往已有的 XFF 后面追加直连对端的 IP，所以最右边那个才是它亲眼看见的，
// 左边的部分客户端可以随便伪造（伪造了就等于自己把自己分到别的桶里，拿不到更宽的额度）。
export function clientIp(req) {
  const xff = String(req.headers?.['x-forwarded-for'] || '');
  const last = xff.split(',').map(s => s.trim()).filter(Boolean).pop();
  return last || req.socket?.remoteAddress || 'unknown';
}
