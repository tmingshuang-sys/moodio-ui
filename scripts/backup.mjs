// 把线上数据备份一份到自己电脑：npm run backup
//
// 服务器上每天凌晨会自动备份一次，但那份和数据在同一台机器上——它防的是「删错了 / 库坏了」，
// 防不了「机器没了」。所以这条命令做的是：让服务器现做一份，然后下载到本机。
// 这才是异地备份。做完一次就有了真正的后悔药。
//
// ⚠️ 下载下来的文件里有密钥（模型 key 在库的 settings 表里是明文存的，.env 里有数据库密码
//    和网关口令）。它落在 ~/WoW备份/ 下，权限 600，别往公开的地方放。
import { mkdirSync, chmodSync, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { HOST, sh, runLong, local, log, die } from './remote.mjs';

const DIR = process.env.WOW_BACKUP_DIR || path.join(homedir(), 'WoW备份');

log('== 1/3 让服务器现做一份备份');
const out = await runLong(`bash ${HOST.appDir}/server/deploy/backup.sh`,
  { logFile: '/tmp/wow-backup.log', done: /备份完成|Error|error:/, maxMinutes: 10, label: '备份' });
if (!/备份完成/.test(out)) die('服务器上备份没做成，看上面的输出');

const remote = (out.match(/备份完成 (\S+)/) || [])[1];
if (!remote) die('没能从输出里认出备份文件的路径');

log('== 2/3 下载到本机');
mkdirSync(DIR, { recursive: true });
const localPath = path.join(DIR, path.basename(remote));
// workbench download 读不了 root 才能进的目录，所以先放到 /tmp 开个读权限，拿完就删
const tmp = `/tmp/${path.basename(remote)}`;
await sh(`cp ${remote} ${tmp} && chmod 644 ${tmp}`);
await local('workbench', ['download', '-i', HOST.instance, '-r', HOST.region, '--remote', tmp, '--local', localPath], { timeout: 600_000 });
await sh(`rm -f ${tmp}`);

if (!existsSync(localPath)) die(`下载完了但本机没有 ${localPath}`);
chmodSync(localPath, 0o600);
const mb = (statSync(localPath).size / 1048576).toFixed(1);

log('== 3/3 核对');
if (statSync(localPath).size < 1024) die('下载下来的文件小得不正常，别当成备份');
log(`\n✓ 备份在本机：${localPath}（${mb} MB）`);
log(`  服务器上也留着最近 7 份：${path.dirname(remote)}`);
log('\n  要恢复的话，在服务器上跑：');
log(`    sudo bash ${HOST.appDir}/server/deploy/restore.sh --latest`);
log('  （没恢复过的备份不算备份，建议现在就演练一次）');
