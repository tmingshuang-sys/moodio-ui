// 手动跑一次清理：npm run purge。服务进程每天也会自己跑，这个是想立刻看结果时用
import { purgeDeletedMedia } from '../src/purge.mjs';
import { closeDb } from '../src/db.mjs';
const r = await purgeDeletedMedia();
console.log(`删了 ${r.purged} 个文件（${(r.bytes / 1048576).toFixed(1)} MB）${r.failed ? `，${r.failed} 个失败` : ''}${r.more ? '，还有没清完的，再跑一次' : ''}`);
await closeDb();
