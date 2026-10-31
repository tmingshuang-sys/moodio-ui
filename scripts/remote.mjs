// 跟线上那台机器打交道的公共部分：deploy.mjs 和 backup.mjs 都用它。
//
// 走的是阿里云 Workbench CLI（workbench exec / download），不是 ssh——机器没有开放 22 给公网，
// Workbench 用的是阿里云自己的通道，鉴权靠 `workbench config` 存在本机的 AccessKey。
// 没装过就先装：curl -fsSL https://workbench-cli.oss-cn-hangzhou.aliyuncs.com/install.sh | bash
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// 这台机器的身份。换机器只改这里，或者用环境变量临时指到别处
export const HOST = {
  instance: process.env.WOW_INSTANCE || 'i-j6c5drkfd0v4igyewyie',
  region: process.env.WOW_REGION || 'cn-hongkong',
  domain: process.env.WOW_DOMAIN || '47-238-73-78.sslip.io',
  appDir: '/opt/wow',
};

export const log = (...a) => console.log(...a);
export const die = (msg) => { console.error('\n✗ ' + msg); process.exit(1); };

// workbench exec 单次有 30 秒上限（它自己掐的，不是本地超时），所以长活儿一律 nohup
// 丢后台 + 轮询日志（见 runLong）。soft: true 时失败返回 null 而不是抛——轮询用得上
export async function sh(command, { timeout = 60_000, soft = false } = {}) {
  try {
    const { stdout, stderr } = await run('workbench',
      ['exec', '-i', HOST.instance, '-r', HOST.region, '--command', command],
      { timeout, maxBuffer: 32 * 1024 * 1024 });
    return (stdout || '') + (stderr || '');
  } catch (e) {
    if (e.code === 'ENOENT') die('没装 Workbench CLI。先跑：\n  curl -fsSL https://workbench-cli.oss-cn-hangzhou.aliyuncs.com/install.sh | bash\n  workbench config   ← 在你自己的「终端」里跑，别在这里跑');
    if (soft) return null;
    throw e;
  }
}

// 丢后台跑一条长命令，边跑边把新日志打出来，结束后返回完整日志。
// done 是跑完要出现在日志里的记号——用它判断结束，比看进程在不在可靠
export async function runLong(command, { logFile, done, maxMinutes = 20, label = '执行中' }) {
  await sh(`rm -f ${logFile}; setsid nohup bash -lc ${JSON.stringify(command)} > ${logFile} 2>&1 < /dev/null & echo 开始`);
  const deadline = Date.now() + maxMinutes * 60_000;
  let offset = 0, all = '', misses = 0;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 6000));
    // 每次只取没读过的那一段（tail -c +N 从第 N 个字节开始）。以前每轮 cat 整个日志，
    // 日志一长单次 exec 就会撞上 30 秒上限，整个部署跟着崩——其实服务器那边早就装完了
    const out = await sh(`tail -c +${offset + 1} ${logFile} 2>/dev/null || true`, { soft: true });
    if (out === null) {                       // 这一轮没问到，不算数，下一轮再说
      if (++misses >= 20) die(`${label}：连续 20 次读不到日志，先看看机器还在不在`);
      continue;
    }
    misses = 0;
    const chunk = out.replace(/\r/g, '');
    if (chunk) { process.stdout.write(chunk); offset += Buffer.byteLength(out); all += chunk; }
    if (done.test(all)) return all;
  }
  die(`${label}超过 ${maxMinutes} 分钟还没结束。上去看看：workbench exec -i ${HOST.instance} -r ${HOST.region} --command 'tail -50 ${logFile}'`);
}

export async function local(cmd, args, opts = {}) {
  try { return (await run(cmd, args, { maxBuffer: 32 * 1024 * 1024, ...opts })).stdout.trim(); }
  catch (e) { if (opts.soft) return null; die(`${cmd} ${args.join(' ')} 失败：\n${e.stderr || e.message}`); }
}
