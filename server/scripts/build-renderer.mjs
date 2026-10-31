// 把前端的渲染核心打包成一份浏览器 ESM，供服务端的渲染页 import。
// 关键点：spec / theme / text / paint 四个文件是纯逻辑（唯一的 document 用法是生成颗粒贴图的离屏 canvas），
// 浏览器和无头 Chrome 里是同一份代码，所以预览和成片不会长得不一样。video.ts 不打进来——那是浏览器侧的
// WebCodecs 驱动，服务端这边由 playwright 截帧 + ffmpeg 编码代替。
import esbuild from 'esbuild';
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
