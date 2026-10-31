// 账号：邮箱 + 密码（scrypt），登录换一个长期 token。
// 第一个账号是管理员；之后的账号用邀请码注册（邀请码在服务器设置里，留空 = 不开放注册）。
// 忘了密码：管理员在「服务器设置」里给那个邮箱生成一条重置链接（24 小时有效、用一次就作废），
// 对方打开链接自己设新密码；管理员自己忘了就在服务器上跑 scripts/reset-link.mjs。没有邮件服务，所以链接是人传人。
// 注意：网关那条路仍然用 ACCESS_TOKEN（页面里填在 API Key 位置），和这里的用户 token 是两套东西，
// 因为网关要给没登录的本地开发页面也能用。
import crypto from 'crypto';
import { db } from './db.mjs';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_DAYS = 90;
const RESET_HOURS = 24;

export const newId = prefix => prefix + '_' + crypto.randomBytes(9).toString('base64url');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const key = Buffer.from(keyB64, 'base64');
  // 长度必须对得上，**这一行是安全要害**：Buffer.from(垃圾, 'base64') 会悄悄得到空 Buffer，
  // 然后 scryptSync(..., keylen=0) 也产出空 Buffer，timingSafeEqual(空, 空) 返回 true——
  // 也就是说库里只要有一条哈希写坏了，那个账号就变成「任何密码都能登」。
  // 正常写入的哈希一定是 16 字节盐 + 64 字节密钥，对不上就直接判错，不去算 scrypt
  if (key.length !== SCRYPT.keylen || salt.length !== 16) return false;
  const got = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return crypto.timingSafeEqual(key, got);
}

// 比较两串口令（邀请码之类），长度不同也走完整个比较，不泄露「对了几位」
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length) { crypto.timingSafeEqual(x, x); return false; }
  return crypto.timingSafeEqual(x, y);
}
// 够不够像一个邮箱。不做 RFC 全量校验，挡住明显写错的就行（没有 @、有空格）
export const validEmail = e => { const s = String(e || '').trim(); return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); };
export const normalizeEmail = e => String(e || '').toLowerCase().trim();
// 重置 token 入库前先哈希：库里存的东西拿出来也用不了
export const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

const publicUser = u => ({ id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin });

export async function createUser({ email, password, name = '', isAdmin = false }) {
  const s = db();
  const id = newId('u');
  await s`insert into users (id, email, name, password_hash, is_admin) values (${id}, ${normalizeEmail(email)}, ${name}, ${hashPassword(password)}, ${isAdmin})`;
  return { id, email: normalizeEmail(email), name, isAdmin };
}

export async function login(email, password) {
  const s = db();
  const [u] = await s`select * from users where email = ${normalizeEmail(email)}`;
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await s`insert into sessions (token, user_id, expires_at) values (${token}, ${u.id}, ${expires})`;
  return { token, expiresAt: expires.toISOString(), user: publicUser(u) };
}

export async function logout(token) {
  await db()`delete from sessions where token = ${token}`;
}

// 从请求头取用户；拿不到返回 null，由调用方决定怎么回
export async function userFor(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return null;
  const s = db();
  const [row] = await s`
    select u.id, u.email, u.name, u.is_admin from sessions s join users u on u.id = s.user_id
    where s.token = ${token} and s.expires_at > now()`;
  return row ? publicUser(row) : null;
}

export async function userByEmail(email) {
  const [u] = await db()`select * from users where email = ${normalizeEmail(email)}`;
  return u ? publicUser(u) : null;
}

// 管理员看的账号列表：谁、什么时候建的、最近一次登录
export async function listUsers() {
  const rows = await db()`
    select u.id, u.email, u.name, u.is_admin, u.created_at,
           (select max(created_at) from sessions where user_id = u.id) as last_login
    from users u order by u.created_at`;
  return rows.map(r => ({ ...publicUser(r), createdAt: r.created_at, lastLogin: r.last_login }));
}

// 生成一条重置链接的 token。返回明文 token（只在这一刻出现一次），库里只留哈希
export async function createResetToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + RESET_HOURS * 3600e3);
  await db()`insert into password_resets (token_hash, user_id, expires_at) values (${hashToken(token)}, ${userId}, ${expires})`;
  return { token, expiresAt: expires.toISOString() };
}

// 拿 token 改密码。成功后这个人所有已登录的会话都作废——密码被改说明之前的会话不可信
export async function resetPassword(token, password) {
  const s = db();
  const [row] = await s`
    select r.token_hash, u.* from password_resets r join users u on u.id = r.user_id
    where r.token_hash = ${hashToken(token || '')} and r.used_at is null and r.expires_at > now()`;
  if (!row) throw new Error('重置链接不对，或者已经过期 / 用过了。让管理员再生成一条');
  await s.begin(async t => {
    await t`update users set password_hash = ${hashPassword(password)} where id = ${row.id}`;
    await t`update password_resets set used_at = now() where token_hash = ${row.token_hash}`;
    await t`delete from sessions where user_id = ${row.id}`;
  });
  return publicUser(row);
}
