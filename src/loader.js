/*
 * Moodio 脚本加载器
 * src/ 下的 12 个脚本原本是同一个 <script> 里的连续代码，彼此依赖函数提升（后面定义的函数在前面就能调用）。
 * 为了让拆分后的行为与原来完全一致，这里按顺序取回全部文件，拼成一段脚本再执行。
 * 编辑时改各个小文件即可；新增文件请同时加进下面的列表（顺序很重要）。
 */
(async () => {
  const files = [
    '01-data.js', '02-story-canvas.js', '03-script-render.js', '04-files-export.js',
    '05-canvas-actions.js', '06-storyboard.js', '07-create-assets.js', '08-writing-sidebar.js',
    '09-cloud-doc.js', '10-editor-interactions.js', '11-agent.js', '12-effects.js',
  ];
  const base = new URL('.', document.currentScript.src);
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
  document.body.insertAdjacentHTML('beforeend', `<p style="position:fixed;inset:auto 16px 16px;padding:12px 16px;border-radius:8px;background:#fbeaea;color:#a12b2b;font:13px/1.6 -apple-system,sans-serif;z-index:99999">脚本加载失败：${String(error.message || error).replace(/</g, '&lt;')}。请通过本地服务器或线上地址打开页面。</p>`);
});
