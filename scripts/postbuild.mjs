// 构建后处理：旧链接仍指向 Moodio-UI-Refined-Storyboard.html，复制一份 index.html 兼容
import { copyFileSync, existsSync } from 'node:fs';
if (existsSync('dist/index.html')) copyFileSync('dist/index.html', 'dist/Moodio-UI-Refined-Storyboard.html');
console.log('dist 已生成');
