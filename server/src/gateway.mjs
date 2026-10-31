// 模型网关：从原来的 Cloudflare Worker（旧仓库里的 gateway/worker.js，已删，在 git 历史里）移植过来，路由与语义保持一致。
// 搬到自己的服务器上有两个原因：① workers.dev 在国内被 DNS 污染并按 SNI 掐 TLS，页面连不稳；
// ② 以后渲染、存储、网关在同一台机器上，生成的素材不用再绕一圈公网。
// 真实 key 只在服务端环境变量里，页面仍然只带 ACCESS_TOKEN。
const DEFAULT_UPSTREAM = 'https://api.deepseek.com/v1';
const KIMI_BASE = 'https://api.moonshot.cn/v1';
const FAL_QUEUE = 'https://queue.fal.run';
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
const BYTEPLUS_BASE = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const MEDIA_HOSTS = /(^|\.)(fal\.media|fal\.run|fal\.ai|volces\.com|byteimg\.com|volccdn\.com|bytepluses\.com|byteplus\.com)$/;
const MAX_BODY = 12 * 1024 * 1024;   // 看图与图生视频会把图片以 data URI 传进来

export function corsHeaders(req, env) {
  const origin = req.headers.origin || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const allowOrigin = allowed.length ? ((allowed.includes(origin) || isLocalDev) ? origin : 'null') : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(payload);
}
const fail = (res, status, message, headers) => send(res, status, { error: { message } }, headers);

export function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > limit) { reject(new Error('请求过大')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// 把上游的响应体原样往下倒，流式回复（text/event-stream）也能一路透传
async function pipeUpstream(res, upstream, cors) {
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
    'Cache-Control': 'no-store',
    ...cors,
  });
  if (!upstream.body) return res.end();
  for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
  res.end();
}

async function upstreamProxy(req, res, url, cors, { prefix, base, auth, name }) {
  const target = base + url.pathname.slice(prefix.length) + url.search;
  const init = { method: req.method, headers: { Authorization: auth, Accept: 'application/json' } };
  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return fail(res, 413, '请求过大', cors); }
    init.headers['Content-Type'] = 'application/json';
    init.body = body;
  }
  let up;
  try { up = await fetch(target, init); } catch (e) { return fail(res, 502, `${name} 连接失败：${e?.message || '未知错误'}`, cors); }
  return pipeUpstream(res, up, cors);
}

async function mediaProxy(req, res, url, cors) {
  const raw = url.searchParams.get('url') || '';
  let target;
  try { target = new URL(raw); } catch { return fail(res, 400, 'url 参数不合法', cors); }
  if (target.protocol !== 'https:' || !MEDIA_HOSTS.test(target.hostname)) return fail(res, 403, '只允许下载模型服务返回的结果地址', cors);
  let up;
  try { up = await fetch(target.toString()); } catch (e) { return fail(res, 502, `下载失败：${e?.message || '未知错误'}`, cors); }
  res.writeHead(up.status, {
    'Content-Type': up.headers.get('Content-Type') || 'application/octet-stream',
    'Cache-Control': 'no-store',
    ...cors,
  });
  if (!up.body) return res.end();
  for await (const chunk of up.body) res.write(Buffer.from(chunk));
  res.end();
}

// 返回 true 表示这个请求由网关处理掉了
export async function handleGateway(req, res, url, env) {
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }

  const p = url.pathname;
  const isGatewayPath = p === '/v1/chat/completions' || p === '/media'
    || ['/fal', '/ark', '/byteplus'].some(x => p === x || p.startsWith(x + '/'));
  if (!isGatewayPath) return false;

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) { fail(res, 401, '访问口令不正确', cors); return true; }

  const proxied = ['POST', 'GET', 'PUT', 'DELETE'].includes(req.method);
  const route = (prefix, base, key, name) => {
    if (!proxied) { fail(res, 405, '只支持 GET / POST / PUT / DELETE', cors); return true; }
    if (!env[key]) { fail(res, 503, `网关还没有配置 ${key}，无法用${name}的模型`, cors); return true; }
    const prefixAuth = key === 'FAL_KEY' ? 'Key ' + env[key] : 'Bearer ' + env[key];
    upstreamProxy(req, res, url, cors, { prefix, base, auth: prefixAuth, name });
    return true;
  };
  if (p === '/fal' || p.startsWith('/fal/')) return route('/fal', FAL_QUEUE, 'FAL_KEY', 'fal');
  if (p === '/ark' || p.startsWith('/ark/')) return route('/ark', ARK_BASE, 'ARK_API_KEY', '火山方舟');
  if (p === '/byteplus' || p.startsWith('/byteplus/')) return route('/byteplus', BYTEPLUS_BASE, 'BYTEPLUS_API_KEY', 'BytePlus');
  if (req.method === 'GET' && p === '/media') { await mediaProxy(req, res, url, cors); return true; }

  if (req.method !== 'POST') { fail(res, 405, '只支持 POST', cors); return true; }
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { fail(res, e?.message === '请求过大' ? 413 : 400, e?.message === '请求过大' ? '请求过大' : '请求体不是合法 JSON', cors); return true; }
  if (!body || !Array.isArray(body.messages)) { fail(res, 400, '缺少 messages', cors); return true; }

  // 文本上游按模型名分流：kimi-* / moonshot-* 走 Moonshot（支持图片输入），其余走 DeepSeek
  const isKimi = /^(kimi|moonshot)/i.test(String(body.model || ''));
  const upstreamKey = isKimi ? env.KIMI_API_KEY : env.DEEPSEEK_API_KEY;
  if (!upstreamKey) { fail(res, isKimi ? 503 : 500, isKimi ? '网关还没有配置 KIMI_API_KEY，无法用 Kimi 模型' : '网关未配置上游 API key', cors); return true; }
  const base = (isKimi ? (env.KIMI_BASE || KIMI_BASE) : (env.UPSTREAM_BASE || DEFAULT_UPSTREAM)).replace(/\/+$/, '');
  let up;
  try {
    up = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + upstreamKey },
      body: JSON.stringify(body),
    });
  } catch (e) { fail(res, 502, `上游连接失败：${e?.message || '未知错误'}`, cors); return true; }
  await pipeUpstream(res, up, cors);
  return true;
}

export const gatewayHealth = env => ({
  deepseek: !!env.DEEPSEEK_API_KEY,
  kimi: !!env.KIMI_API_KEY,
  fal: !!env.FAL_KEY,
  ark: !!env.ARK_API_KEY,
  byteplus: !!env.BYTEPLUS_API_KEY,
});
