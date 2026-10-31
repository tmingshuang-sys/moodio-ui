// 密码哈希。这块错了不会报错，只会「谁都能登进来」或者「谁都登不进来」，必须有用例守着。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newId } from '../src/auth.mjs';

test('对的密码能验过，错的验不过', () => {
  const stored = hashPassword('正确的密码 correct-horse');
  assert.equal(verifyPassword('正确的密码 correct-horse', stored), true);
  assert.equal(verifyPassword('正确的密码 correct-hors', stored), false);
  assert.equal(verifyPassword('', stored), false);
  assert.equal(verifyPassword('正确的密码 correct-horse ', stored), false, '末尾多一个空格也是错的');
});

test('同一个密码两次哈希结果不同——盐是随机的', () => {
  const a = hashPassword('一样的密码');
  const b = hashPassword('一样的密码');
  assert.notEqual(a, b, '两次哈希相同说明没加盐，拖库之后能直接看出谁和谁密码一样');
  assert.ok(verifyPassword('一样的密码', a) && verifyPassword('一样的密码', b));
});

test('哈希串是 scrypt$盐$密钥 三段，不含明文', () => {
  const stored = hashPassword('明文不该出现 plaintext-should-not-appear');
  const [scheme, salt, key] = stored.split('$');
  assert.equal(scheme, 'scrypt');
  assert.ok(salt.length > 16 && key.length > 64);
  assert.ok(!stored.includes('plaintext-should-not-appear'), '哈希串里不许出现明文');
});

test('存的东西被改坏时一律验不过，而不是抛异常', () => {
  // 这些都可能在库被手改、迁移出错时出现。抛异常会变成 500，吞掉会变成「谁都能进」，
  // 正确的行为是老老实实返回 false
  for (const bad of ['', null, undefined, 'garbage', 'scrypt$', 'scrypt$onlysalt', 'md5$a$b', '$$', 'scrypt$!!!$!!!']) {
    assert.equal(verifyPassword('随便什么密码', bad), false, `verifyPassword 对 ${JSON.stringify(bad)} 应当返回 false`);
  }
});

test('newId 带前缀、够随机、URL 安全', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newId('u')));
  assert.equal(ids.size, 500, '500 个 id 不该撞');
  for (const id of ids) assert.match(id, /^u_[A-Za-z0-9_-]{12}$/);
});
