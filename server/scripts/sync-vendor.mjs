// vendor/lemo-opuscar 是上游（MIT）的原样镜像，不改一个字；运行时需要它躺在 runtime/core/ 下，
// 因为上游的 page.mjs 用 import.meta.url 往上两级算静态根（core/render/x.mjs → 根），而且它们的页面
// 一律用 /core/lib.js 这种绝对路径。拷过去而不是做软链：软链会被 Node 解析成真实路径，根就算错了。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const FROM = path.join(ROOT, 'vendor', 'lemo-opuscar');
const TO = path.join(ROOT, 'runtime', 'core');

if (!fs.existsSync(path.join(FROM, 'render', 'video.mjs'))) {
  console.error(`vendor 不完整：${FROM} 里没有 render/video.mjs`);
  process.exit(1);
}
fs.rmSync(TO, { recursive: true, force: true });
fs.mkdirSync(TO, { recursive: true });
let n = 0;
for (const rel of ['lib.js', 'LICENSE', 'render']) {
  const src = path.join(FROM, rel);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(TO, rel), { recursive: true });
  n += fs.statSync(src).isDirectory() ? fs.readdirSync(src).length : 1;
}
fs.chmodSync(path.join(TO, 'render', 'mux.sh'), 0o755);
console.log(`vendor → runtime/core：${n} 个文件`);
