// 构建发布目录 dist/：HTML + styles.css + 拼接后的 app.js（保持与开发时相同的执行语义）
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
const html = readFileSync('Moodio-UI-Refined-Storyboard.html', 'utf8');
const files = JSON.parse(readFileSync('src/manifest.json', 'utf8'));
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/src', { recursive: true });
const app = files.map(f => `/* ===== src/${f} ===== */\n` + readFileSync(`src/${f}`, 'utf8')).join('\n');
writeFileSync('dist/src/app.js', app);
copyFileSync('src/styles.css', 'dist/src/styles.css');
const tag = '<script src="src/loader.js"></script>';
if (!html.includes(tag)) throw new Error('页面里找不到 loader 标签');
const out = html.replace(tag, '<script src="src/app.js"></script>');
writeFileSync('dist/index.html', out);
writeFileSync('dist/Moodio-UI-Refined-Storyboard.html', out);
console.log(`dist 已生成：app.js ${(app.length / 1024).toFixed(0)} KB，来自 ${files.length} 个文件`);
