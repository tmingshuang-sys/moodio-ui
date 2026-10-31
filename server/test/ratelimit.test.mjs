// 限流器。它拦错了会把人关在门外，拦漏了门就是开的，所以每条规则单独守一个用例。
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, clientIp, __reset, __size } from '../src/ratelimit.mjs';

let now = 1_000_000;
const clock = () => now;
const limiter = () => createLimiter({ limit: 3, windowMs: 60_000, blockMs: 300_000, now: clock });

beforeEach(() => { __reset(); now = 1_000_000; });

test('连续失败到上限才挡，没到之前放行', () => {
  const l = limiter();
  assert.equal(l.retryAfter('a'), 0);
  l.fail('a'); assert.equal(l.retryAfter('a'), 0, '第 1 次不该挡');
  l.fail('a'); assert.equal(l.retryAfter('a'), 0, '第 2 次不该挡');
  l.fail('a');
  assert.equal(l.retryAfter('a'), 300, '第 3 次到上限，挡 300 秒');
});

test('挡住之后时间走完自动放开', () => {
  const l = limiter();
  for (let i = 0; i < 3; i++) l.fail('a');
  now += 299_000;
  assert.equal(l.retryAfter('a'), 1);
  now += 2_000;
  assert.equal(l.retryAfter('a'), 0, '过期了就该放行');
});

test('失败之间隔得够久就不算连续——偶尔记错密码不该攒成封禁', () => {
  const l = limiter();
  l.fail('a');
  now += 61_000;          // 超出窗口
  l.fail('a');
  now += 61_000;
  l.fail('a');
  assert.equal(l.retryAfter('a'), 0, '三次失败但互相隔了一分钟以上，不该挡');
});

test('成功一次就把失败记录清掉', () => {
  const l = limiter();
  l.fail('a'); l.fail('a');
  l.clear('a');
  l.fail('a'); l.fail('a');
  assert.equal(l.retryAfter('a'), 0, '清过之后要重新数');
});

test('不同 key 互不影响——别人猜错不能把我关在外面', () => {
  const l = limiter();
  for (let i = 0; i < 5; i++) l.fail('攻击者');
  assert.ok(l.retryAfter('攻击者') > 0);
  assert.equal(l.retryAfter('我'), 0);
});

test('两个限流器各数各的，不会串桶', () => {
  const a = createLimiter({ limit: 3, windowMs: 60_000, blockMs: 60_000, now: clock });
  const b = createLimiter({ limit: 9, windowMs: 60_000, blockMs: 60_000, now: clock });
  for (let i = 0; i < 3; i++) a.fail('k');
  assert.ok(a.retryAfter('k') > 0);
  assert.equal(b.retryAfter('k'), 0, '限额不同的限流器不该共用计数');
});

test('key 再多也不会把内存撑爆', () => {
  const l = createLimiter({ limit: 3, windowMs: 60_000, blockMs: 60_000, now: clock });
  for (let i = 0; i < 12_000; i++) l.fail('ip-' + i);
  assert.ok(__size() <= 10_000, `桶的数量应当有上限，现在是 ${__size()}`);
});

test('真实 IP 取 X-Forwarded-For 的最后一个（Caddy 追加的那个才可信）', () => {
  const req = (xff, socket = '127.0.0.1') => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: socket } });
  assert.equal(clientIp(req('203.0.113.9')), '203.0.113.9');
  // 客户端自己伪造了一个，Caddy 把真实对端追加在后面
  assert.equal(clientIp(req('1.1.1.1, 203.0.113.9')), '203.0.113.9');
  // 没有代理时回落到 socket
  assert.equal(clientIp(req('', '198.51.100.7')), '198.51.100.7');
  assert.equal(clientIp({ headers: {}, socket: {} }), 'unknown');
});
