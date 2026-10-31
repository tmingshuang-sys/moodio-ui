// 构建后处理
import { copyFileSync, existsSync } from 'node:fs';

// 旧链接仍指向 Moodio-UI-Refined-Storyboard.html，复制一份 index.html 兼容
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/Moodio-UI-Refined-Storyboard.html');

// 本地助手供页面下载。只在 helper/ 留一份源码，构建时拷进去——
// 以前 public/ 下还放了一份一模一样的，两份都在 git 里，改一份忘另一份是迟早的事
copyFileSync('helper/moodio-helper.py', 'dist/moodio-helper.py');

console.log('dist 已生成');
