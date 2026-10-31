// 构建后处理
import { copyFileSync, existsSync } from 'node:fs';

// 旧链接仍指向 Moodio-UI-Refined-Storyboard.html，复制一份 index.html 兼容
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/Moodio-UI-Refined-Storyboard.html');

// 本地助手供页面下载。只在 helper/ 留一份源码，构建时拷进去——
// 以前 public/ 下还放了一份一模一样的，两份都在 git 里，改一份忘另一份是迟早的事
copyFileSync('helper/moodio-helper.py', 'dist/moodio-helper.py');

console.log('dist 已生成');

// 渲染字体必须随页面发出去：少一个字重 canvas 不会报错，只会悄悄退回系统字体，成片就和预览不一致了。
// GB2312 子集约 1.4 MB，掉到几十 KB 说明子集化时汉字没进去。所以在构建这一步就拦下来，而不是上线后看成片
import { statSync as fontStat } from 'node:fs';
for (const w of [400, 700]) {
  const file = `dist/fonts/wow-sans-${w}.woff2`;
  let size = 0;
  try { size = fontStat(file).size; } catch { /* 不存在 */ }
  if (size < 1_000_000) { console.error(`✗ ${file} ${size ? `只有 ${(size / 1024).toFixed(0)} KB` : '不存在'}：渲染字体没打进去，见 scripts/build-font.sh`); process.exit(1); }
}
console.log('渲染字体已随 dist 发出（400 / 700）');
