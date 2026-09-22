/**
 * Moodio 模型网关（Cloudflare Worker）
 * - 浏览器只知道网关地址和共享口令，真实的模型 API key 只存在 Worker 的密钥里
 * - 文本：POST /v1/chat/completions（OpenAI 兼容，支持 stream、thinking、reasoning_effort 等参数原样转发）
 * - 图片 / 视频：/fal/* 透传到 fal.ai 队列接口，/ark/* 透传到火山方舟（Seedance / Seedream），/media?url= 代下载生成结果
 * - 环境变量：
 *     DEEPSEEK_API_KEY  （secret）文本模型上游 API key
 *     FAL_KEY           （secret）fal.ai 的 key，形如 id:secret；不配置时 /fal/* 返回 503
 *     ARK_API_KEY       （secret）火山方舟的 key；不配置时 /ark/* 返回 503
 *     ACCESS_TOKEN      （secret）共享口令，页面设置里填在 API Key 位置
 *     UPSTREAM_BASE     （var）文本上游地址，默认 https://api.deepseek.com/v1
 *     ALLOWED_ORIGINS   （var）允许的页面来源，逗号分隔；留空表示允许所有
 */
const DEFAULT_UPSTREAM = 'https://api.deepseek.com/v1';
const FAL_QUEUE = 'https://queue.fal.run';
const ARK_BASE = 'https://ark.cn-beijing.volces.com/api/v3';
// /media 只允许代下载这两家自己的结果地址
const MEDIA_HOSTS = /(^|\.)(fal\.media|fal\.run|fal\.ai|volces\.com|byteimg\.com|volccdn\.com)$/;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isLocalDev = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);   // 本机开发：任意端口都放行
  const allowOrigin = allowed.length ? ((allowed.includes(origin) || isLocalDev) ? origin : 'null') : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

// 图片 / 视频：把 /fal/* 和 /ark/* 原样转发到上游，补上真实 key（PUT / DELETE 用于取消任务）
async function upstreamProxy(request, url, cors, { prefix, base, auth, name }) {
  const target = base + url.pathname.slice(prefix.length) + url.search;
  const init = { method: request.method, headers: { 'Authorization': auth, 'Accept': 'application/json' } };
  if (request.method === 'POST') {
    const body = await request.text();
    if (body.length > 12 * 1024 * 1024) return json({ error: { message: '请求过大' } }, 413, cors);   // 图生视频会把参考图以 data URI 传进来
    init.headers['Content-Type'] = 'application/json';
    init.body = body;
  }
  let res;
  try { res = await fetch(target, init); } catch (e) { return json({ error: { message: name + ' 连接失败：' + (e && e.message ? e.message : '未知错误') } }, 502, cors); }
  const headers = new Headers(cors);
  headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, headers });
}

// 生成结果存在 fal 的 CDN 上，代下载一次避免浏览器端跨域失败
async function mediaProxy(request, env, url, cors) {
  const raw = url.searchParams.get('url') || '';
  let target;
  try { target = new URL(raw); } catch (_) { return json({ error: { message: 'url 参数不合法' } }, 400, cors); }
  if (target.protocol !== 'https:' || !MEDIA_HOSTS.test(target.hostname)) {
    return json({ error: { message: '只允许下载模型服务返回的结果地址' } }, 403, cors);
  }
  let res;
  try { res = await fetch(target.toString()); } catch (e) { return json({ error: { message: '下载失败：' + (e && e.message ? e.message : '未知错误') } }, 502, cors); }
  const headers = new Headers(cors);
  headers.set('Content-Type', res.headers.get('Content-Type') || 'application/octet-stream');
  headers.set('Cache-Control', 'no-store');
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true, service: 'moodio-gateway', fal: !!env.FAL_KEY, ark: !!env.ARK_API_KEY }, 200, cors);
    }

    // 共享口令：页面在 API Key 位置填的就是它（先校验口令，再检查网关自身配置）
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) {
      return json({ error: { message: '访问口令不正确' } }, 401, cors);
    }

    const proxied = ['POST', 'GET', 'PUT', 'DELETE'].includes(request.method);
    if (url.pathname === '/fal' || url.pathname.startsWith('/fal/')) {
      if (!proxied) return json({ error: { message: '只支持 GET / POST / PUT / DELETE' } }, 405, cors);
      if (!env.FAL_KEY) return json({ error: { message: '网关还没有配置 FAL_KEY，无法用 fal 的模型' } }, 503, cors);
      return upstreamProxy(request, url, cors, { prefix: '/fal', base: FAL_QUEUE, auth: 'Key ' + env.FAL_KEY, name: 'fal' });
    }
    if (url.pathname === '/ark' || url.pathname.startsWith('/ark/')) {
      if (!proxied) return json({ error: { message: '只支持 GET / POST / PUT / DELETE' } }, 405, cors);
      if (!env.ARK_API_KEY) return json({ error: { message: '网关还没有配置 ARK_API_KEY，无法用火山方舟的模型' } }, 503, cors);
      return upstreamProxy(request, url, cors, { prefix: '/ark', base: ARK_BASE, auth: 'Bearer ' + env.ARK_API_KEY, name: '火山方舟' });
    }
    if (request.method === 'GET' && url.pathname === '/media') return mediaProxy(request, env, url, cors);

    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      return json({ error: { message: '支持 POST /v1/chat/completions、/fal/*、/ark/*、GET /media' } }, 404, cors);
    }
    if (!env.DEEPSEEK_API_KEY) return json({ error: { message: '网关未配置上游 API key' } }, 500, cors);

    let body;
    try { body = await request.json(); } catch (_) { return json({ error: { message: '请求体不是合法 JSON' } }, 400, cors); }
    if (!body || !Array.isArray(body.messages)) return json({ error: { message: '缺少 messages' } }, 400, cors);
    if (JSON.stringify(body).length > 2 * 1024 * 1024) return json({ error: { message: '请求过大' } }, 413, cors);

    const upstream = (env.UPSTREAM_BASE || DEFAULT_UPSTREAM).replace(/\/+$/, '') + '/chat/completions';
    let res;
    try {
      res = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return json({ error: { message: '上游连接失败：' + (e && e.message ? e.message : '未知错误') } }, 502, cors);
    }

    // 流式与非流式都直接透传，保留 content-type（text/event-stream 或 application/json）
    const headers = new Headers(cors);
    headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  },
};
