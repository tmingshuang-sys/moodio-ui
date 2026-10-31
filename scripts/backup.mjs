// 把线上数据备份一份到自己电脑：npm run backup
//
// 服务器上每天凌晨会自动备份一次，但那份和数据在同一台机器上——它防的是「删错了 / 库坏了」，
// 防不了「机器没了」。所以这条命令做的是：让服务器现做一份，然后下载到本机。
// 这才是异地备份。做完一次就有了真正的后悔药。
//
// ⚠️ 下载下来的文件里有密钥（模型 key 在库的 settings 表里是明文存的，.env 里有数据库密码
//    和网关口令）。它落在 ~/WoW备份/ 下，权限 600，别往公开的地方放。
import { mkdirSync, chmodSync, existsSync, statSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import path from 'node:path';
import { HOST, sh, runLong, local, log, die } from './remote.mjs';

const DIR = process.env.WOW_BACKUP_DIR || path.join(homedir(), 'WoW备份');

log('== 1/3 让服务器现做一份备份');
const out = await runLong(`bash ${HOST.appDir}/server/deploy/backup.sh`,
  { logFile: '/tmp/wow-backup.log', done: /备份完成|Error|error:/, maxMinutes: 10, label: '备份' });
if (!/备份完成/.test(out)) die('服务器上备份没做成，看上面的输出');

// 按 BACKUP_FILE= 那一行取路径。别去解析「备份完成 xxx（8.0K）」那句——
// 全角括号不是空白字符，\S+ 会把「（8.0K）」一起吃进路径里
const remote = (out.match(/^BACKUP_FILE=(.+)$/m) || [])[1]?.trim();
if (!remote) die('没能从输出里认出备份文件的路径');

log('== 2/3 下载到本机');
mkdirSync(DIR, { recursive: true });
const localPath = path.join(DIR, path.basename(remote));
// workbench download 读不了 root 才能进的目录，所以先放到 /tmp 开个读权限，拿完就删
const tmp = `/tmp/${path.basename(remote)}`;
await sh(`cp ${remote} ${tmp} && chmod 644 ${tmp}`);
// 用法是位置参数 `download <远端路径> [本地路径]`，没有 --remote / --local 这种 flag
await local('workbench', ['download', tmp, localPath, '-i', HOST.instance, '-r', HOST.region, '-f'], { timeout: 600_000 });
await sh(`rm -f ${tmp}`);

if (!existsSync(localPath)) die(`下载完了但本机没有 ${localPath}`);
chmodSync(localPath, 0o600);
const mb = (statSync(localPath).size / 1048576).toFixed(1);

log('== 3/3 核对里面真有东西');
// 只看压缩包大小不够：空的 tar.gz 也有几百字节。真的解出来看。
// （别去解析 tar -tzvf 的列——BSD tar 和 GNU tar 列数不一样，踩过）
const listing = await local('tar', ['-tzf', localPath]);
for (const f of ['db.dump', 'blobs.tar.gz']) if (!listing.includes(f)) die(`备份里没有 ${f}，这份不能用`);

const probe = mkdtempSync(path.join(tmpdir(), 'wow-backup-'));
await local('tar', ['-xzf', localPath, '-C', probe, './db.dump']);
const dump = path.join(probe, 'db.dump');
const dumpSize = statSync(dump).size;
// pg_dump 的 custom 格式以 "PGDMP" 开头。确认这一点才算「这是一份真的数据库导出」，
// 而不是一个碰巧叫 db.dump 的空文件
const magic = readFileSync(dump).subarray(0, 5).toString('latin1');
rmSync(probe, { recursive: true, force: true });
if (magic !== 'PGDMP') die(`db.dump 开头是 ${JSON.stringify(magic)}，不是 pg_dump 的格式`);
if (dumpSize < 4096) die(`db.dump 只有 ${dumpSize} 字节，不像是完整的数据库导出`);
log(`   db.dump ${(dumpSize / 1024).toFixed(0)} KB（PGDMP 格式正确），blobs 和配置都在`);

log(`\n✓ 备份在本机：${localPath}（${mb} MB）`);
log(`  服务器上也留着最近 7 份：${path.dirname(remote)}`);
log('\n  要恢复的话，在服务器上跑：');
log(`    sudo bash ${HOST.appDir}/server/deploy/restore.sh --latest`);
log('  （没恢复过的备份不算备份，建议现在就演练一次）');
