// 把前端的渲染核心打包成一份浏览器 ESM，供服务端的渲染页 import。
// 关键点：spec / theme / text / paint 四个文件是纯逻辑（唯一的 document 用法是生成颗粒贴图的离屏 canvas），
// 浏览器和无头 Chrome 里是同一份代码，所以预览和成片不会长得不一样。video.ts 不打进来——那是浏览器侧的
// WebCodecs 驱动，服务端这边由 playwright 截帧 + ffmpeg 编码代替。
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APP = path.resolve(ROOT, '..');

const out = path.join(ROOT, 'runtime', 'wow', 'renderer.js');
await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'render', 'renderer-entry.ts')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  outfile: out,
  absWorkingDir: APP,
  logLevel: 'warning',
});
console.log('renderer →', path.relative(APP, out));

// 字体也要拷到渲染页旁边：渲染页在 /wow/ 下，fonts.ts 的 fontBase() 在那条路下返回 './fonts/'。
// 和前端 public/fonts/ 是同一份文件——这正是两边字形一致的全部原因，别让它们分叉
const fontSrc = path.join(APP, 'public', 'fonts');
const fontOut = path.join(ROOT, 'runtime', 'wow', 'fonts');
fs.mkdirSync(fontOut, { recursive: true });
for (const f of fs.readdirSync(fontSrc)) fs.copyFileSync(path.join(fontSrc, f), path.join(fontOut, f));
console.log('字体 →', path.relative(APP, fontOut), `(${fs.readdirSync(fontOut).length} 个文件)`);
