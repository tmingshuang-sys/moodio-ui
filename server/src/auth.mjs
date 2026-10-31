// 账号：邮箱 + 密码（scrypt），登录换一个长期 token。
// 现在实际上只有一个用户，但接口和库表按多用户写，以后开放注册不用改结构。
// 注意：网关那条路仍然用 ACCESS_TOKEN（页面里填在 API Key 位置），和这里的用户 token 是两套东西，
// 因为网关要给没登录的本地开发页面也能用。
import crypto from 'crypto';
import { db } from './db.mjs';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };
const SESSION_DAYS = 90;

export const newId = prefix => prefix + '_' + crypto.randomBytes(9).toString('base64url');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  const [scheme, saltB64, keyB64] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, 'base64');
  const got = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), key.length, SCRYPT);
  return crypto.timingSafeEqual(key, got);
}

export async function createUser({ email, password, name = '' }) {
  const s = db();
  const id = newId('u');
  await s`insert into users (id, email, name, password_hash) values (${id}, ${email.toLowerCase().trim()}, ${name}, ${hashPassword(password)})`;
  return { id, email, name };
}

export async function login(email, password) {
  const s = db();
  const [u] = await s`select * from users where email = ${String(email || '').toLowerCase().trim()}`;
  if (!u || !verifyPassword(password, u.password_hash)) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await s`insert into sessions (token, user_id, expires_at) values (${token}, ${u.id}, ${expires})`;
  return { token, expiresAt: expires.toISOString(), user: { id: u.id, email: u.email, name: u.name } };
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
    select u.id, u.email, u.name from sessions s join users u on u.id = s.user_id
    where s.token = ${token} and s.expires_at > now()`;
  return row || null;
}
