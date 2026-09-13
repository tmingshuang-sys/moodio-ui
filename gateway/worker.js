/**
 * Moodio 模型网关（Cloudflare Worker）
 * - 浏览器只知道网关地址和共享口令，真实的模型 API key 只存在 Worker 的密钥里
 * - 对外暴露 OpenAI 兼容接口：POST /v1/chat/completions（支持 stream、thinking、reasoning_effort 等参数原样转发）
 * - 环境变量：
 *     DEEPSEEK_API_KEY  （secret）上游 API key
 *     ACCESS_TOKEN      （secret）共享口令，页面设置里填在 API Key 位置
 *     UPSTREAM_BASE     （var）上游地址，默认 https://api.deepseek.com/v1
 *     ALLOWED_ORIGINS   （var）允许的页面来源，逗号分隔；留空表示允许所有
 */
const DEFAULT_UPSTREAM = 'https://api.deepseek.com/v1';

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length ? (allowed.includes(origin) ? origin : 'null') : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ ok: true, service: 'moodio-gateway' }, 200, cors);
    }
    if (request.method !== 'POST' || url.pathname !== '/v1/chat/completions') {
      return json({ error: { message: '只支持 POST /v1/chat/completions' } }, 404, cors);
    }
    if (!env.DEEPSEEK_API_KEY) return json({ error: { message: '网关未配置上游 API key' } }, 500, cors);

    // 共享口令：页面在 API Key 位置填的就是它
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!env.ACCESS_TOKEN || token !== env.ACCESS_TOKEN) {
      return json({ error: { message: '访问口令不正确' } }, 401, cors);
    }

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
