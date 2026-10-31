// 阿里云 OSS 的最小客户端：V4 签名 + put / get / del / stat + 一个探活。只用 node 自带的 crypto 与 fetch，不装 SDK。
// 为什么不用官方 ali-oss：它带进来几十个依赖，而我们只要四个对象操作；签名算法是公开的，
// 官方文档给了完整算例（密钥、日期、规范化请求、最终签名），test/oss.test.mjs 用那组数逐步对——对上了就是对了。
//
// 几个容易错的点，都在测试里钉着：
//   · scope 里的 region 不带 oss- 前缀：endpoint 是 oss-cn-hongkong.aliyuncs.com，签名里写 cn-hongkong
//   · 规范化 URI 永远是 /bucket/object（哪怕请求用的是 bucket.endpoint 这种虚拟主机式地址），bucket 级操作是 /bucket/
//   · 必签的头：x-oss-content-sha256（固定 UNSIGNED-PAYLOAD）；出现了就要签的：content-type、content-md5、x-oss-*
//   · 规范化请求里头部段之后有一个空行，再是附加头列表（可以为空），再是载荷哈希
import crypto from 'crypto';

const ALGO = 'OSS4-HMAC-SHA256';
export const UNSIGNED = 'UNSIGNED-PAYLOAD';

const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest();
const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex');

// RFC 3986：字母数字和 - _ . ~ 不编码，其余按 UTF-8 逐字节 %XX（大写）；路径里的 / 保留
export function uriEncode(s, keepSlash = false) {
  let out = '';
  for (const ch of String(s)) {
    if (/^[A-Za-z0-9\-_.~]$/.test(ch) || (keepSlash && ch === '/')) out += ch;
    else for (const b of Buffer.from(ch, 'utf8')) out += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

export const signRegion = region => String(region || '').replace(/^oss-/, '').replace(/-internal$/, '');

// 20250411T064124Z 这种 ISO8601 紧凑格式
export const isoDate = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// 查询串：先编码再按编码后的字符串排序（官方 SDK 就是这么做的——'+' 编成 %2B 之后排在字母前面），空值只写键名
const queryString = query => Object.entries(query)
  .map(([k, v]) => [uriEncode(k), (v === '' || v == null) ? '' : uriEncode(v)])
  .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  .map(([k, v]) => (v ? `${k}=${v}` : k)).join('&');

const isDefaultSigned = k => k === 'content-type' || k === 'content-md5' || k.startsWith('x-oss-');

// 规范化请求。additional 是除必签头之外还要签的头（我们自己不用，测试里为了对齐官方算例用到）
export function additionalHeaders(headers = {}, additional = []) {
  const lower = new Set(Object.entries(headers).filter(([, v]) => String(v ?? '') !== '').map(([k]) => k.toLowerCase()));
  return additional.map(a => a.toLowerCase()).filter(k => !isDefaultSigned(k) && lower.has(k)).sort();
}

export function canonicalRequest({ method, bucket, key = '', query = {}, headers = {}, additional = [] }) {
  const path = '/' + uriEncode(bucket) + '/' + uriEncode(key, true);
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  // 附加头只算请求里真有的、且本来就不必签的那些（官方 SDK 的 _common_additional_headers 同样处理）
  const add = additional.map(a => a.toLowerCase()).filter(k => !isDefaultSigned(k) && lower[k]).sort();
  const signed = Object.keys(lower).filter(k => isDefaultSigned(k) || add.includes(k)).sort();
  const canonHeaders = signed.map(k => `${k}:${lower[k]}\n`).join('');
  return `${method}\n${path}\n${queryString(query)}\n${canonHeaders}\n${add.join(';')}\n${UNSIGNED}`;
}

export const scopeOf = (date, region) => `${date.slice(0, 8)}/${region}/oss/aliyun_v4_request`;
export const stringToSign = (canon, date, region) => `${ALGO}\n${date}\n${scopeOf(date, region)}\n${sha256hex(canon)}`;

// 派生签名密钥：HMAC 链从 "aliyun_v4" + Secret 开始，依次喂日期、region、"oss"、"aliyun_v4_request"
export function signingKey(secret, day, region) {
  return hmac(hmac(hmac(hmac('aliyun_v4' + secret, day), region), 'oss'), 'aliyun_v4_request');
}

export function authorization({ accessKeyId, accessKeySecret, region, date, canon, additional = [] }) {
  const sig = crypto.createHmac('sha256', signingKey(accessKeySecret, date.slice(0, 8), region))
    .update(stringToSign(canon, date, region)).digest('hex');
  const add = additional.length ? `,AdditionalHeaders=${additional.map(a => a.toLowerCase()).sort().join(';')}` : '';
  return `${ALGO} Credential=${accessKeyId}/${scopeOf(date, region)}${add},Signature=${sig}`;
}

// ---- 凭证来源 ----
// 两种：① 静态 AccessKey（界面或 .env 里填）；② ECS 实例 RAM 角色——机器自己向元数据服务要一组几小时有效的临时凭证，
// 自动轮换，机器上、库里、对话里都不存任何密钥。线上推荐 ②：给 ECS 挂一个只有 OSS 权限的角色，把角色名填进 OSS_ROLE 即可。
export function staticCredentials({ accessKeyId, accessKeySecret }) {
  return async () => ({ accessKeyId, accessKeySecret, token: '' });
}
const METADATA = 'http://100.100.100.200/latest';
export function instanceRoleCredentials(role, { fetchImpl = fetch, base = METADATA, now = Date.now } = {}) {
  let cache = null;
  return async () => {
    if (cache && Date.parse(cache.expiration) - now() > 5 * 60_000) return cache;    // 还有 5 分钟以上才到期就复用
    const headers = {};
    try {   // 元数据服务的加固模式要先换一个短期 token；普通模式这一步也能成功，所以统一先试
      const t = await fetchImpl(`${base}/api/token`, { method: 'PUT', headers: { 'X-aliyun-ecs-metadata-token-ttl-seconds': '300' }, signal: AbortSignal.timeout(3000) });
      if (t.ok) headers['X-aliyun-ecs-metadata-token'] = await t.text();
    } catch { /* 拿不到就走普通模式 */ }
    let res;
    try { res = await fetchImpl(`${base}/meta-data/ram/security-credentials/${encodeURIComponent(role)}`, { headers, signal: AbortSignal.timeout(3000) }); }
    catch (e) { throw new Error(`连不上 ECS 元数据服务（${e.cause?.code || e.message}）：只有跑在阿里云 ECS 上才能用实例角色`); }
    if (!res.ok) throw new Error(`实例角色 ${role} 取不到临时凭证（HTTP ${res.status}）：确认这台 ECS 真的挂上了这个 RAM 角色`);
    const j = await res.json();
    if (j.Code && j.Code !== 'Success') throw new Error(`实例角色 ${role} 取临时凭证失败：${j.Code}`);
    cache = { accessKeyId: j.AccessKeyId, accessKeySecret: j.AccessKeySecret, token: j.SecurityToken, expiration: j.Expiration };
    return cache;
  };
}

// 把 OSS 的 XML 错误翻成一句人话。常见的三种单独说清楚，别让用户去查错误码表
function explain(status, text) {
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] || '';
  const msg = /<Message>([^<]+)<\/Message>/.exec(text)?.[1] || '';
  if (code === 'InvalidAccessKeyId') return 'AccessKey ID 不对（OSS 不认识它）';
  if (code === 'SignatureDoesNotMatch') return 'AccessKey Secret 不对';
  if (code === 'AccessDenied') return '这个 AccessKey 没有操作该 bucket 的权限（去 RAM 给它授权）';
  if (code === 'NoSuchBucket' || status === 404 && !code) return 'bucket 不存在，或者区域（OSS_REGION）填错了';
  return `HTTP ${status}${code ? ' ' + code : ''}${msg ? '（' + msg + '）' : ''}`;
}

export function createOss({ bucket, region, endpoint, accessKeyId, accessKeySecret, role, credentials }) {
  if (!bucket || !region) throw new Error('OSS 配置不全：bucket 和 region 都要有');
  const creds = credentials || (role ? instanceRoleCredentials(role) : (accessKeyId && accessKeySecret ? staticCredentials({ accessKeyId, accessKeySecret }) : null));
  if (!creds) throw new Error('OSS 没有凭证：填实例角色名（OSS_ROLE，推荐），或者 AccessKey ID 与 Secret');
  const host = `${bucket}.${endpoint || `${region}.aliyuncs.com`}`;
  const sregion = signRegion(region);

  async function call(method, key, { body, headers = {}, query = {} } = {}) {
    const c = await creds();
    const date = isoDate();
    const h = { 'x-oss-date': date, 'x-oss-content-sha256': UNSIGNED, ...(c.token ? { 'x-oss-security-token': c.token } : {}), ...headers };
    const canon = canonicalRequest({ method, bucket, key, query, headers: h });
    h.Authorization = authorization({ accessKeyId: c.accessKeyId, accessKeySecret: c.accessKeySecret, region: sregion, date, canon });
    const qs = Object.keys(query).length ? '?' + queryString(query) : '';
    try {
      return await fetch(`https://${host}/${uriEncode(key, true)}${qs}`, { method, headers: h, body, redirect: 'manual' });
    } catch (e) {
      throw new Error(`连不上 ${host}：${e.cause?.code || e.message}`);
    }
  }
  const fail = async (res, what) => { throw new Error(`OSS ${what}失败：${explain(res.status, await res.text().catch(() => ''))}`); };

  return {
    kind: 'oss',
    bucket, region, host, auth: role ? 'role' : 'ak',
    async put(key, buf, mime = 'application/octet-stream') {
      const res = await call('PUT', key, { body: buf, headers: { 'Content-Type': mime } });
      if (!res.ok) await fail(res, '上传');
      return key;
    },
    async get(key) {
      const res = await call('GET', key);
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, '下载');
      return Buffer.from(await res.arrayBuffer());
    },
    async del(key) {
      const res = await call('DELETE', key);
      if (!res.ok && res.status !== 404) await fail(res, '删除');
    },
    async stat(key) {
      const res = await call('HEAD', key);
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, '查询');
      return { size: +(res.headers.get('content-length') || 0) };
    },
    // 探活：HEAD bucket。通了返回 ok；没通把原因翻成人话（AK 不对 / 没权限 / bucket 或区域不对）
    async ping() {
      try {
        const res = await call('HEAD', '');
        if (res.ok) return { ok: true };
        return { ok: false, error: explain(res.status, await res.text().catch(() => '')) };
      } catch (e) { return { ok: false, error: String(e.message) }; }
    },
  };
}
