// 一条命令上线：npm run deploy
//
// 顺序是固定的，而且每一步不过就停：
//   本地闸（tsc + 测试）→ 确认没有没提交的改动 → push 到 GitHub
//   → 服务器从 GitHub 拉下来重新构建重启 → 自检外网能不能打开
//
// 为什么一定要经过 GitHub：服务器上的代码是 `git reset --hard origin/<分支>` 出来的，
// 直接改服务器上的文件，下次部署会被无声地冲掉。GitHub 是唯一的真相。
import { HOST, sh, runLong, local, log, die } from './remote.mjs';

const BRANCH = process.env.WOW_BRANCH || 'main';

log('== 1/5 本地闸：类型检查 + 测试');
await local('npm', ['run', 'check']);
await local('npm', ['test']);
log('   通过');

log('== 2/5 确认改动都提交了');
const dirty = await local('git', ['status', '--porcelain']);
if (dirty) die(`还有没提交的改动，先 commit：\n${dirty}`);
const branch = await local('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== BRANCH) die(`当前在 ${branch} 分支，但要部署的是 ${BRANCH}。切过去再来，或者 WOW_BRANCH=${branch} npm run deploy`);

log(`== 3/5 推到 GitHub（${BRANCH}）`);
// 这台电脑访问 GitHub 必须走代理，见 CLAUDE.md
const proxy = { HTTPS_PROXY: 'http://127.0.0.1:7890', HTTP_PROXY: 'http://127.0.0.1:7890' };
await local('git', ['push', 'origin', BRANCH], { env: { ...process.env, ...proxy } });
const head = await local('git', ['rev-parse', '--short', 'HEAD']);
log(`   ${head} 已推送`);

log('== 4/5 服务器拉代码、重新构建、重启');
// setup.sh 跑到一半会把自己 git reset 掉，所以先拉代码、再从 /tmp 的副本跑（脚本自己也有这层保护）
const cmd = [
  `su - wow -c "cd ${HOST.appDir} && git fetch --depth 1 origin ${BRANCH} -q && git reset --hard -q origin/${BRANCH}"`,
  `cp ${HOST.appDir}/server/deploy/setup.sh /tmp/wow-setup-run.sh`,
  `bash /tmp/wow-setup-run.sh --domain ${HOST.domain} --branch ${BRANCH}`,
].join(' && ');
await runLong(cmd, { logFile: '/tmp/wow-deploy.log', done: /={10,}\s*$/m, label: '部署' });

log('== 5/5 自检');
const health = await sh(`curl -fsS -m 15 https://${HOST.domain}/health; echo; curl -fsS -m 15 -o /dev/null -w "页面 HTTP %{http_code}\\n" https://${HOST.domain}/`);
log(health.trim());
if (!/"ok":true/.test(health)) die('后端自检没过，看上面的输出');
if (!/HTTP 200/.test(health)) die('页面打不开，看上面的输出');

const live = await sh(`su - wow -c "cd ${HOST.appDir} && git rev-parse --short HEAD"`);
if (!live.includes(head)) die(`线上跑的是 ${live.trim()}，不是刚推的 ${head}——代码没真正更新`);

log(`\n✓ 上线完成  https://${HOST.domain}  （${head}）`);
