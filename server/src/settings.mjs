// 服务端配置：模型 key 之类的东西，存库、界面上改、立刻生效，不用再进终端改 .env 重启。
// 取值优先级：库 > .env。这样已经在 .env 里填过的不受影响，界面上填了就以界面为准。
import crypto from 'crypto';
import { db, hasDb } from './db.mjs';

// 能在界面上配的键。白名单写死，不让任意键写进库（否则界面就成了任意配置注入的入口）
export const SETTING_KEYS = [
  { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek', hint: '文本模型，规划与写作的主力', secret: true },
  { key: 'KIMI_API_KEY', label: 'Kimi（Moonshot）', hint: '文本 + 看图；参考图质检要它', secret: true },
  { key: 'FAL_KEY', label: 'fal.ai', hint: '图片 / 视频 / 配音，形如 id:secret', secret: true },
  { key: 'ARK_API_KEY', label: '火山方舟', hint: 'Seedream 出图', secret: true },
  { key: 'BYTEPLUS_API_KEY', label: 'BytePlus', hint: 'Seedance 出视频', secret: true },
  { key: 'ACCESS_TOKEN', label: '网关口令', hint: '页面调模型接口时带的口令；改了要在模型设置里同步', secret: true },
];
const KEY_SET = new Set(SETTING_KEYS.map(k => k.key));

let cache = null;
let cachedAt = 0;
const TTL = 5000;

export async function allSettings() {
  if (!hasDb()) return {};
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const rows = await db()`select key, value from settings`;
  cache = Object.fromEntries(rows.map(r => [r.key, r.value]));
  cachedAt = Date.now();
  return cache;
}
export const invalidate = () => { cache = null; };

// 网关用：库里有就用库里的，否则用进程环境变量
export async function effectiveEnv(env) {
  const s = await allSettings().catch(() => ({}));
  return new Proxy({}, { get: (_, k) => (typeof k === 'string' && s[k]) || env[k] });
}

// 给界面看的：只说有没有配、什么时候改的，绝不回传值本身
export async function settingsStatus(env) {
  const s = await allSettings().catch(() => ({}));
  const rows = hasDb() ? await db()`select key, updated_at from settings` : [];
  const when = Object.fromEntries(rows.map(r => [r.key, r.updated_at]));
  return SETTING_KEYS.map(d => ({
    ...d,
    set: !!(s[d.key] || env[d.key]),
    from: s[d.key] ? 'db' : env[d.key] ? 'env' : null,
    updatedAt: when[d.key] || null,
  }));
}

export async function saveSettings(patch, userId) {
  const s = db();
  const changed = [];
  for (const [key, value] of Object.entries(patch || {})) {
    if (!KEY_SET.has(key)) continue;
    const v = String(value ?? '');
    if (v === '') {                               // 传空字符串 = 清掉这一项，回落到 .env
      await s`delete from settings where key = ${key}`;
    } else {
      await s`insert into settings (key, value, updated_by) values (${key}, ${v}, ${userId || null})
              on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`;
    }
    changed.push(key);
  }
  invalidate();
  return changed;
}

// ---- 首次安装的一次性口令：没有任何用户时，拿着它才能创建第一个账号 ----
export async function ensureSetupToken() {
  const s = db();
  const [{ count }] = await s`select count(*)::int as count from users`;
  if (count > 0) return null;
  const [existing] = await s`select token from setup_tokens where used_at is null order by created_at desc limit 1`;
  if (existing) return existing.token;
  const token = crypto.randomBytes(16).toString('hex');
  await s`insert into setup_tokens (token) values (${token})`;
  return token;
}
export async function consumeSetupToken(token) {
  const s = db();
  const [{ count }] = await s`select count(*)::int as count from users`;
  if (count > 0) throw new Error('已经有账号了，初始化口令不再可用');
  const [row] = await s`select token from setup_tokens where token = ${String(token || '')} and used_at is null`;
  if (!row) throw new Error('初始化口令不对，或者已经用过了');
  await s`update setup_tokens set used_at = now() where token = ${row.token}`;
  return true;
}
export async function needsSetup() {
  if (!hasDb()) return false;
  const [{ count }] = await db()`select count(*)::int as count from users`;
  return count === 0;
}
