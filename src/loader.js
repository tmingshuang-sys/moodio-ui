/*
 * Moodio 脚本加载器（仅开发环境使用）
 * src/ 下的脚本原本是同一个 <script> 里的连续代码，彼此依赖函数提升（后面定义的函数在前面就能调用）。
 * 开发时按 manifest.json 的顺序取回全部文件，拼成一段脚本执行，行为与单文件完全一致。
 * 发布时由 scripts/build.mjs 在构建阶段拼成 src/app.js，线上页面不经过这个加载器。
 * 新增文件请加进 src/manifest.json（顺序很重要）。
 */
(async () => {
  const base = new URL('.', document.currentScript.src);
  const files = await (await fetch(new URL('manifest.json', base), { cache: 'no-cache' })).json();
  const parts = await Promise.all(files.map(async f => {
    const res = await fetch(new URL(f, base), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`无法加载 ${f}（HTTP ${res.status}）`);
    return `/* ===== src/${f} ===== */\n` + await res.text();
  }));
  const script = document.createElement('script');
  script.textContent = parts.join('\n') + '\n//# sourceURL=moodio-app.js';
  document.body.appendChild(script);
})().catch(error => {
  console.error(error);
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;inset:auto 16px 16px;padding:12px 16px;border-radius:8px;background:#fbeaea;color:#a12b2b;font:13px/1.6 -apple-system,sans-serif;z-index:99999">脚本加载失败：${String(error.message || error).replace(/</g, '&lt;')}。请通过本地服务器（npm run serve）打开页面。</p>`);
});
