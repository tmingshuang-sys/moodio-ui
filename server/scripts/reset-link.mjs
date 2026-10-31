// 管理员自己忘了密码时用：在服务器上给某个邮箱生成一条密码重置链接（24 小时有效、用一次作废）。
//   cd /opt/wow/server && npm run reset:link -- 你的邮箱
// 普通账号忘了密码不用这个，管理员在网页「服务器设置 → 账号」里点一下就有。
import { userByEmail, createResetToken } from '../src/auth.mjs';
import { closeDb } from '../src/db.mjs';

const email = process.argv[2];
if (!email) { console.error('用法：npm run reset:link -- 邮箱'); process.exit(2); }
const u = await userByEmail(email);
if (!u) { console.error(`没有 ${email} 这个账号`); await closeDb(); process.exit(1); }
const { token, expiresAt } = await createResetToken(u.id);
console.log(`把这个路径接在站点地址后面打开（${new Date(expiresAt).toLocaleString('zh-CN')} 前有效，用一次就作废）：\n\n  /?reset=${token}\n`);
await closeDb();
