// WoW 后端入口。一个进程里三件事：
//   ① 模型网关  /v1/chat/completions、/fal/*、/ark/*、/byteplus/*、/media   （口令 = ACCESS_TOKEN）
//   ② 数据同步  /api/auth/*、/api/projects、/api/sync/*、/api/media/:id      （口令 = 用户 token）
//   ③ 渲染任务  /api/render/*                                               （口令 = 用户 token）
// 没配 DATABASE_URL 时 ② ③ 直接回 503，但 ① 照常工作——这样「只想把网关搬出 workers.dev」可以单独部署。
import http from 'http';
import { randomUUID } from 'crypto';
import { handleGateway, corsHeaders, gatewayHealth, readBody } from './gateway.mjs';
import { db, hasDb, migrate } from './db.mjs';
import { userFor, login, logout, createUser, newId } from './auth.mjs';
import { ensureProject, listProjects, pull, push } from './sync.mjs';
import { blobs, mediaKey } from './store.mjs';
import { prepareJob, renderVideo, readcheck, runtimeReady } from './render/job.mjs';

const PORT = +(process.env.PORT || 8787);
const env = process.env;

const json = (res, status, body, cors = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors });
  res.end(JSON.stringify(body));
};

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
    await blobs.put(key, buf);
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

  if (p === '/api/auth/login' && req.method === 'POST') {
    const b = await body();
    const r = b && await login(b.email, b.password);
    return r ? json(res, 200, r, cors) : json(res, 401, { error: { message: '邮箱或密码不对' } }, cors);
  }
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const auth = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (auth) await logout(auth);
    return json(res, 200, { ok: true }, cors);
  }

  const user = await userFor(req);
  if (!user) return json(res, 401, { error: { message: '没登录' } }, cors);

  if (p === '/api/me') return json(res, 200, { user }, cors);

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
      const buf = await blobs.get(row.object_key);
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
      await blobs.put(key, buf);
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
    const buf = await blobs.get(row.object_key);
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
      return json(res, 200, { ok: true, service: 'wow-server', db: hasDb(), render: runtimeReady().length === 0, blobs: blobs.kind, ...gatewayHealth(env) }, cors);
    }
    if (await handleGateway(req, res, url, env)) return;
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
} else {
  console.log('没有 DATABASE_URL：只提供模型网关，数据与渲染接口返回 503');
}
const missing = runtimeReady();
if (missing.length) console.log('渲染环境还没装好：' + missing.join('、'));
server.listen(PORT, () => console.log(`wow-server http://127.0.0.1:${PORT}`));
