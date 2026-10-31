// WoW 后端入口。一个进程里三件事：
//   ① 模型网关  /v1/chat/completions、/fal/*、/ark/*、/byteplus/*、/media   （口令 = ACCESS_TOKEN）
//   ② 数据同步  /api/auth/*、/api/projects、/api/sync/*、/api/media/:id      （口令 = 用户 token）
//   ③ 渲染任务  /api/render/*                                               （口令 = 用户 token）
// 没配 DATABASE_URL 时 ② ③ 直接回 503，但 ① 照常工作——这样「只想把网关搬出 workers.dev」可以单独部署。
import http from 'http';
import { randomUUID } from 'crypto';
import { handleGateway, corsHeaders, gatewayHealth, readBody } from './gateway.mjs';
import { db, hasDb, migrate } from './db.mjs';
import { userFor, login, logout, createUser, newId, validEmail, safeEqual, createResetToken, resetPassword, listUsers, userByEmail } from './auth.mjs';
import { ensureProject, listProjects, pull, push } from './sync.mjs';
import { blobs, blobDir, mediaKey, blobsHealth } from './store.mjs';
import { SETTING_KEYS, settingsStatus, saveSettings, effectiveEnv, needsSetup, ensureSetupToken, consumeSetupToken } from './settings.mjs';
import { prepareJob, renderVideo, readcheck, runtimeReady } from './render/job.mjs';
import { createLimiter, clientIp } from './ratelimit.mjs';

// 猜口令的限流。只对失败计数，正常请求完全不受影响（见 ratelimit.mjs 开头的说明）。
// 登录按 IP 和按邮箱各限一次：只按 IP 挡不住换着 IP 刷同一个账号，只按邮箱挡不住拿一堆邮箱试弱密码。
const loginByIp = createLimiter({ limit: 8, windowMs: 10 * 60_000, blockMs: 15 * 60_000 });
const loginByEmail = createLimiter({ limit: 8, windowMs: 10 * 60_000, blockMs: 15 * 60_000 });
const setupByIp = createLimiter({ limit: 5, windowMs: 10 * 60_000, blockMs: 60 * 60_000 });
// 注册（猜邀请码）与密码重置（猜链接）也是「拿着一串字符来试」的接口，和初始化口令同一个待遇
const registerByIp = createLimiter({ limit: 5, windowMs: 10 * 60_000, blockMs: 60 * 60_000 });
const resetByIp = createLimiter({ limit: 5, windowMs: 10 * 60_000, blockMs: 60 * 60_000 });

const PORT = +(process.env.PORT || 8787);
const env = process.env;

const json = (res, status, body, cors = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors });
  res.end(JSON.stringify(body));
};
// 对象存储（OSS）出错：原因写进响应，前端能照着改配置；笼统的 500 谁也看不出是 OSS 的事
const storageError = (res, e, cors) => { console.error('[storage]', e.message); return json(res, 502, { error: { message: `媒体存储出错：${e.message}` } }, cors); };

// 渲染任务队列：同一时间只跑一个，渲染很吃 CPU，排队比并发稳。
// 进程重启会丢掉内存里的队列，所以 queued / running 的任务在启动时统一标成 failed，让前端能重试，
// 而不是永远停在「渲染中」——这种挂死比失败更烦人。
const queue = [];
let running = false;
async function pump() {
  if (running || !queue.length) return;
  running = true;
  const job = queue.shift();
  const s = db();
  try {
    await s`update render_jobs set status = 'running', stage = '渲染画面', started_at = now() where id = ${job.id}`;
    const spec = job.spec;
    await prepareJob(job.id, spec, job.media || {});
    const rc = await readcheck(job.id, { ratio: spec.ratio });
    await s`update render_jobs set readcheck = ${s.json(rc)} where id = ${job.id}`;
    // 三个 worker 各渲一段、各报各的进度，得合起来算，不然进度条会往回跳
    const seen = new Map();
    let lastWrite = 0;
    const out = await renderVideo(job.id, {
      fps: spec.fps || 30,
      ratio: spec.ratio || '9:16',
      onProgress: p => {
        seen.set(p.worker, p);
        let done = 0, total = 0;
        for (const x of seen.values()) { done += x.done; total += x.total; }
        const ratio = total ? Math.min(0.99, done / total) : 0;
        if (Date.now() - lastWrite < 1000) return;     // 每秒最多写一次库，别让进度把连接池占满
        lastWrite = Date.now();
        s`update render_jobs set progress = ${ratio} where id = ${job.id}`.catch(() => {});
      },
    });
    const buf = await (await import('fs/promises')).readFile(out.path);
    const key = mediaKey(job.user_id, job.id, '.mp4');
    await blobs.put(key, buf, 'video/mp4');
    await s`update render_jobs set status = 'done', stage = '', progress = 1, object_key = ${key}, finished_at = now() where id = ${job.id}`;
  } catch (e) {
    await s`update render_jobs set status = 'failed', error = ${String(e?.message || e).slice(0, 2000)}, finished_at = now() where id = ${job.id}`.catch(() => {});
  } finally {
    running = false;
    setImmediate(pump);
  }
}

async function handleApi(req, res, url, cors) {
  const p = url.pathname;
  if (!hasDb()) return json(res, 503, { error: { message: '后端没有配置 DATABASE_URL，数据与渲染接口不可用' } }, cors);

  const body = async () => { try { return JSON.parse(await readBody(req) || '{}'); } catch { return null; } };

  const ip = clientIp(req);
  const tooMany = (res, secs) => json(res, 429, { error: { message: `试得太频繁了，${Math.ceil(secs / 60)} 分钟后再来` } }, { ...cors, 'Retry-After': String(secs) });

  if (p === '/api/auth/setup' && req.method === 'POST') {
    const wait = setupByIp.retryAfter(ip);
    if (wait) return tooMany(res, wait);
    const b = await body();
    if (!b?.email || !b?.password) return json(res, 400, { error: { message: '要填邮箱和密码' } }, cors);
    if (!validEmail(b.email)) return json(res, 400, { error: { message: '邮箱格式不对' } }, cors);
    if (String(b.password).length < 8) return json(res, 400, { error: { message: '密码至少 8 位' } }, cors);
    try {
      await consumeSetupToken(b.token);
      await createUser({ email: b.email, password: b.password, name: b.name || '', isAdmin: true });   // 第一个账号就是管理员
      setupByIp.clear(ip);
      return json(res, 200, await login(b.email, b.password), cors);
    } catch (e) {
      setupByIp.fail(ip);      // 一次性口令猜错也要计数，否则它就成了另一个可以慢慢猜的密码
      return json(res, 400, { error: { message: String(e.message) } }, cors);
    }
  }
  if (p === '/api/auth/login' && req.method === 'POST') {
    const b = await body();
    const mail = String(b?.email || '').toLowerCase().trim();
    const wait = Math.max(loginByIp.retryAfter(ip), loginByEmail.retryAfter(mail));
    if (wait) return tooMany(res, wait);
    const r = b && await login(b.email, b.password);
    if (!r) {
      loginByIp.fail(ip); loginByEmail.fail(mail);
      return json(res, 401, { error: { message: '邮箱或密码不对' } }, cors);
    }
    loginByIp.clear(ip); loginByEmail.clear(mail);   // 密码记错一次不该留下痕迹
    return json(res, 200, r, cors);
  }
  // 注册：邀请码在服务器设置里（INVITE_CODE），没设就是不开放。邀请码猜错按 IP 计数
  if (p === '/api/auth/register' && req.method === 'POST') {
    const wait = registerByIp.retryAfter(ip);
    if (wait) return tooMany(res, wait);
    const b = await body();
    if (!b?.email || !b?.password) return json(res, 400, { error: { message: '要填邮箱和密码' } }, cors);
    if (!validEmail(b.email)) return json(res, 400, { error: { message: '邮箱格式不对' } }, cors);
    if (String(b.password).length < 8) return json(res, 400, { error: { message: '密码至少 8 位' } }, cors);
    const expected = (await effectiveEnv(env)).INVITE_CODE;
    if (!expected) return json(res, 403, { error: { message: '这台后端没有开放注册。让管理员在「服务器设置 → 账号」里设一个邀请码' } }, cors);
    if (!safeEqual(String(b.invite || '').trim(), expected)) { registerByIp.fail(ip); return json(res, 403, { error: { message: '邀请码不对' } }, cors); }
    try {
      await createUser({ email: b.email, password: b.password, name: String(b.name || '').slice(0, 60) });
    } catch (e) {
      if (e.code === '23505') return json(res, 409, { error: { message: '这个邮箱已经注册过了，直接登录' } }, cors);
      throw e;
    }
    registerByIp.clear(ip);
    return json(res, 200, await login(b.email, b.password), cors);
  }
  // 拿重置链接改密码。链接由管理员生成（或服务器上的 scripts/reset-link.mjs），24 小时有效、用一次作废
  if (p === '/api/auth/reset' && req.method === 'POST') {
    const wait = resetByIp.retryAfter(ip);
    if (wait) return tooMany(res, wait);
    const b = await body();
    if (!b?.token || !b?.password) return json(res, 400, { error: { message: '缺少重置链接或新密码' } }, cors);
    if (String(b.password).length < 8) return json(res, 400, { error: { message: '密码至少 8 位' } }, cors);
    try {
      const u = await resetPassword(String(b.token), String(b.password));
      resetByIp.clear(ip);
      return json(res, 200, await login(u.email, b.password), cors);
    } catch (e) {
      resetByIp.fail(ip);
      return json(res, 400, { error: { message: String(e.message) } }, cors);
    }
  }
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (auth) await logout(auth);
    return json(res, 200, { ok: true }, cors);
  }

  const user = await userFor(req);
  if (!user) return json(res, 401, { error: { message: '没登录' } }, cors);

  if (p === '/api/me') return json(res, 200, { user }, cors);

  // 下面这些只有管理员能碰：模型 key、邀请码、OSS、账号列表、别人的密码重置链接
  const adminOnly = () => json(res, 403, { error: { message: '只有管理员能做这个' } }, cors);
  if (p === '/api/settings') {
    if (!user.isAdmin) return adminOnly();
    if (req.method === 'GET') return json(res, 200, { settings: await settingsStatus(env) }, cors);
    if (req.method === 'PUT') {
      const b = await body();
      const changed = await saveSettings(b?.settings || {}, user.id);
      return json(res, 200, { changed, settings: await settingsStatus(env) }, cors);
    }
  }

  if (p === '/api/admin/users' && req.method === 'GET') {
    if (!user.isAdmin) return adminOnly();
    return json(res, 200, { users: await listUsers() }, cors);
  }
  if (p === '/api/admin/reset-link' && req.method === 'POST') {
    if (!user.isAdmin) return adminOnly();
    const b = await body();
    const target = await userByEmail(b?.email);
    if (!target) return json(res, 404, { error: { message: '没有这个邮箱的账号' } }, cors);
    const r = await createResetToken(target.id);
    return json(res, 200, { email: target.email, url: '/?reset=' + r.token, expiresAt: r.expiresAt }, cors);
  }

  // 渲染任务列表：看到在跑什么、失败的是哪一条
  if (p === '/api/render' && req.method === 'GET') {
    const rows = await db()`select id, project_id, doc_id, status, stage, progress, error, readcheck, object_key, created_at, started_at, finished_at,
                                   coalesce(spec->>'title', '未命名') as title
                            from render_jobs where user_id = ${user.id} order by created_at desc limit 50`;
    return json(res, 200, { jobs: rows }, cors);
  }

  if (p === '/api/projects') {
    if (req.method === 'GET') return json(res, 200, { projects: await listProjects(user.id) }, cors);
    if (req.method === 'POST') {
      const b = await body(); if (!b?.id) return json(res, 400, { error: { message: '缺少 id' } }, cors);
      const ok = await ensureProject(user.id, b);
      return json(res, ok ? 200 : 403, ok ? { ok: true } : { error: { message: '这个创作 id 已经属于别人' } }, cors);
    }
  }

  if (p === '/api/sync/pull' && req.method === 'POST') {
    const b = await body();
    try { return json(res, 200, await pull(user.id, b?.projectId, b?.since), cors); }
    catch (e) { return json(res, 400, { error: { message: String(e.message) } }, cors); }
  }
  if (p === '/api/sync/push' && req.method === 'POST') {
    const b = await body();
    try { return json(res, 200, { applied: await push(user.id, b?.projectId, b || {}) }, cors); }
    catch (e) { return json(res, 400, { error: { message: String(e.message) } }, cors); }
  }

  // 媒体二进制：PUT 上传、GET 下载。元数据走 /api/sync/push，这里只管文件本身
  const m = /^\/api\/media\/([\w.-]+)$/.exec(p);
  if (m) {
    const id = m[1];
    const s = db();
    const [row] = await s`
      select md.* from media md join projects pr on pr.id = md.project_id
      where md.id = ${id} and pr.user_id = ${user.id}`;
    if (!row) return json(res, 404, { error: { message: '没有这个媒体，或者它不属于你' } }, cors);
    if (req.method === 'GET') {
      if (!row.object_key) return json(res, 404, { error: { message: '这个媒体还没上传文件' } }, cors);
      let buf;
      try { buf = await blobs.get(row.object_key); } catch (e) { return storageError(res, e, cors); }
      if (!buf) return json(res, 404, { error: { message: '文件不在存储里' } }, cors);
      res.writeHead(200, { 'Content-Type': row.mime || 'application/octet-stream', 'Content-Length': buf.length, ...cors });
      return res.end(buf);
    }
    if (req.method === 'PUT') {
      const chunks = []; let n = 0;
      for await (const c of req) { n += c.length; if (n > 512 * 1024 * 1024) { req.destroy(); return json(res, 413, { error: { message: '文件过大' } }, cors); } chunks.push(c); }
      const buf = Buffer.concat(chunks);
      const ext = (/\.([a-z0-9]{2,4})$/i.exec(row.name) || [, ''])[1];
      const key = mediaKey(user.id, id, ext ? '.' + ext.toLowerCase() : '');
      try { await blobs.put(key, buf, row.mime || 'application/octet-stream'); } catch (e) { return storageError(res, e, cors); }
      await s`update media set object_key = ${key}, size = ${buf.length}, updated_at = now() where id = ${id}`;
      return json(res, 200, { ok: true, key, size: buf.length }, cors);
    }
  }

  if (p === '/api/render' && req.method === 'POST') {
    const b = await body();
    if (!b?.spec?.beats?.length) return json(res, 400, { error: { message: '缺少画面方案' } }, cors);
    const missing = runtimeReady();
    if (missing.length) return json(res, 503, { error: { message: '渲染环境没装好：' + missing.join('、') } }, cors);
    const id = newId('r').replace(/[^\w-]/g, '');
    const s = db();
    await s`insert into render_jobs (id, user_id, project_id, doc_id, spec)
            values (${id}, ${user.id}, ${b.projectId || null}, ${b.docId || null}, ${s.json(b.spec)})`;
    queue.push({ id, user_id: user.id, spec: b.spec, media: {} });
    setImmediate(pump);
    return json(res, 202, { id, status: 'queued', ahead: queue.length - 1 }, cors);
  }
  const rj = /^\/api\/render\/([\w-]+)$/.exec(p);
  if (rj && req.method === 'GET') {
    const [row] = await db()`select id, status, stage, progress, error, readcheck, object_key, created_at, finished_at
                             from render_jobs where id = ${rj[1]} and user_id = ${user.id}`;
    return row ? json(res, 200, row, cors) : json(res, 404, { error: { message: '没有这个任务' } }, cors);
  }
  const rf = /^\/api\/render\/([\w-]+)\/file$/.exec(p);
  if (rf && req.method === 'GET') {
    const [row] = await db()`select object_key from render_jobs where id = ${rf[1]} and user_id = ${user.id}`;
    if (!row?.object_key) return json(res, 404, { error: { message: '成片还没好' } }, cors);
    let buf;
    try { buf = await blobs.get(row.object_key); } catch (e) { return storageError(res, e, cors); }
    if (!buf) return json(res, 404, { error: { message: '文件不在存储里' } }, cors);
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': buf.length, ...cors });
    return res.end(buf);
  }

  return json(res, 404, { error: { message: '没有这个接口' } }, cors);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const cors = corsHeaders(req, env);
  const rid = randomUUID().slice(0, 8);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      const e = await effectiveEnv(env);
      const storage = await blobsHealth();
      return json(res, 200, { ok: true, service: 'wow-server', db: hasDb(), render: runtimeReady().length === 0, blobs: storage.kind, storage,
        setup: hasDb() ? await needsSetup().catch(() => false) : false, ...gatewayHealth(e) }, cors);
    }
    if (await handleGateway(req, res, url, await effectiveEnv(env))) return;
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url, cors);
    return json(res, 404, { error: { message: '没有这个接口' } }, cors);
  } catch (e) {
    console.error(`[${rid}]`, e);
    if (!res.headersSent) json(res, 500, { error: { message: `服务器内部错误（${rid}）` } }, cors);
    else res.end();
  }
});

if (hasDb()) {
  await migrate();
  // 上次进程没跑完的任务不会自己复活，标成失败让前端能重试，别停在「渲染中」挂死
  const stuck = await db()`update render_jobs set status = 'failed', error = '服务重启时中断', finished_at = now()
                           where status in ('queued', 'running') returning id`;
  if (stuck.length) console.log(`把 ${stuck.length} 个中断的渲染任务标成了失败`);
  const setupToken = await ensureSetupToken().catch(() => null);
  if (setupToken) console.log(`还没有任何账号。打开页面后用这个一次性口令创建第一个：${setupToken}`);
} else {
  console.log('没有 DATABASE_URL：只提供模型网关，数据与渲染接口返回 503');
}
const missing = runtimeReady();
if (missing.length) console.log('渲染环境还没装好：' + missing.join('、'));
const storage = await blobsHealth();
console.log(storage.kind === 'oss'
  ? (storage.ok ? `媒体文件存 OSS：${storage.bucket}（${storage.region}）` : `OSS 配了但连不上：${storage.error}（上传与下载会失败，直到修好或清掉 OSS_BUCKET）`)
  : `媒体文件存本机磁盘：${blobDir}`);
server.listen(PORT, () => console.log(`wow-server http://127.0.0.1:${PORT}`));
