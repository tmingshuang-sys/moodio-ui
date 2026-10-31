// 一次服务端渲染 = 一个任务目录 + 调用上游的 video.mjs。
// 任务目录放在 runtime 之外，由上游 serve.mjs 的 /@film/ 挂载点提供，所以页面既能拿到自己的
// spec.json 和 media/，又能用 /core/… 与 /wow/… 这些绝对路径——和上游的片子目录是同一套规矩。
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(HERE, '..', '..');
export const RUNTIME = path.join(SERVER_ROOT, 'runtime');
export const JOBS = process.env.WOW_JOBS_DIR || path.join(SERVER_ROOT, 'jobs');
const VIDEO = path.join(RUNTIME, 'core', 'render', 'video.mjs');
const READCHECK = path.join(RUNTIME, 'core', 'render', 'readcheck.mjs');

export function runtimeReady() {
  const missing = [];
  if (!fss.existsSync(VIDEO)) missing.push('runtime/core（跑 npm run sync:vendor）');
  if (!fss.existsSync(path.join(RUNTIME, 'wow', 'renderer.js'))) missing.push('runtime/wow/renderer.js（跑 npm run build:renderer）');
  return missing;
}

const RATIO_SIZE = { '9:16': '1080x1920', '16:9': '1920x1080', '1:1': '1080x1080' };

// 把一份画面方案 + 它引用的图片写成任务目录
export async function prepareJob(jobId, spec, media = {}) {
  const dir = path.join(JOBS, jobId);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(path.join(dir, 'media'), { recursive: true });
  await fs.writeFile(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 1));
  await fs.copyFile(path.join(RUNTIME, 'wow', 'page.html'), path.join(dir, 'index.html'));
  for (const [id, buf] of Object.entries(media)) await fs.writeFile(path.join(dir, 'media', id), buf);
  return dir;
}

function run(cmd, args, { cwd, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    const take = buf => {
      const s = String(buf);
      tail = (tail + s).slice(-4000);
      if (onLine) for (const line of s.split('\n')) if (line.trim()) onLine(line.trim());
    };
    p.stdout.on('data', take);
    p.stderr.on('data', take);
    p.on('error', e => reject(new Error(`${cmd} 起不来：${e.message}`)));
    p.on('close', code => (code === 0 ? resolve(tail) : reject(new Error(`${cmd} 退出码 ${code}\n${tail}`))));
  });
}

// 渲染：无声的画面轨。声音与成片合成在 mix 那一步（见 src/render/mix.mjs）
export async function renderVideo(jobId, { fps = 30, ratio = '9:16', workers = 3, onProgress } = {}) {
  const missing = runtimeReady();
  if (missing.length) throw new Error('运行时没装好：' + missing.join('、'));
  const dir = path.join(JOBS, jobId);
  const out = path.join(dir, 'out', 'video.mp4');
  const t0 = Date.now();
  await run(process.execPath, [VIDEO, dir, '--fps', String(fps), '--workers', String(workers), '--size', RATIO_SIZE[ratio] || RATIO_SIZE['9:16'], '--out', out], {
    cwd: RUNTIME,
    onLine: line => { const m = /^w(\d+) (\d+)\/(\d+)/.exec(line); if (m && onProgress) onProgress({ worker: +m[1], done: +m[2], total: +m[3] }); },
  });
  const { size } = await fs.stat(out);
  return { path: out, ms: Date.now() - t0, size };
}

// 可读时间自检：一块文字从完整进画起，停留时间要 ≥ 汉字数/4.5 + 其他/15 + 1.5 秒
// 退出码 0 通过、1 有不达标的、2 没跑成（页面没给 TEXTS）——2 不算通过
export async function readcheck(jobId, { ratio = '9:16' } = {}) {
  const dir = path.join(JOBS, jobId);
  try {
    const out = await run(process.execPath, [READCHECK, dir, '--size', RATIO_SIZE[ratio] || RATIO_SIZE['9:16']], { cwd: RUNTIME });
    return { ok: true, report: out.trim() };
  } catch (e) {
    return { ok: false, report: String(e.message) };
  }
}

export async function cleanJob(jobId) {
  await fs.rm(path.join(JOBS, jobId), { recursive: true, force: true });
}
