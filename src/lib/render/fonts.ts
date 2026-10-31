// ===== 渲染用的自带字体 =====
// 渲染核心同一份代码，浏览器和服务器各跑一遍，但字体以前来自各自的系统——Mac 落到苹方、
// Ubuntu 落到 Noto Sans CJK。字形不同还只是观感，**字宽不同会改折行位置**：预览里排好的版，
// 到成片上可能多出一行或者挤出画面。自带字体之后两边加载同一个文件，这件事不再发生。
//
// 字体只有渲染才用，UI 本身不用，所以**按需加载**：不碰科普流水线的人永远不下载这 2.7 MB。
//
// canvas 有个坑必须注意：`ctx.fillText` 用一个还没加载完的字体**不会报错，会悄悄退回系统字体**。
// `document.fonts.ready` 也不够——它只等排版引擎主动请求过的字体，canvas 不走排版，不算在内。
// 所以画第一帧之前必须显式 `document.fonts.load(字号+字体名)`，这就是 loadRenderFont() 的存在意义。
//
// 服务端还有一个坑：Linux 上的 headless Chromium 默认对 webfont 开 full hinting，把每个字宽取整——
// 同一句 64px 混合串 Mac 量出 1974.336，服务端不带参数量出 1977，折行就可能多一行。
// 上游 core/render/browser.mjs 的 ARGS 带着 `--font-render-hinting=none`，关掉之后服务端量出 1974.332，
// 和 Mac 只差浮点误差。自己另起 Chromium 量字宽或截帧时记得带上这个参数。
export const RENDER_FONT = 'WoW Sans';

// 相对路径：页面在 /（线上 Caddy 发 dist）、渲染页在 /wow/（服务端那条路）各有一份，
// 所以这里给的是 base，具体前缀由 fontBase() 决定
const FILES = [
  { weight: 400, file: 'wow-sans-400.woff2' },
  { weight: 700, file: 'wow-sans-700.woff2' },
];

// 服务端渲染页在 /wow/page.html 下，字体和它放在一起；浏览器里页面在站点根下，字体在 /fonts/
function fontBase(): string {
  if (typeof location !== 'undefined' && location.pathname.includes('/wow/')) return './fonts/';
  return '/fonts/';
}

let injected = false;
export function ensureFontFace(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const base = fontBase();
  const css = FILES.map(f => `@font-face{font-family:"${RENDER_FONT}";font-weight:${f.weight};font-style:normal;font-display:block;src:url("${base}${f.file}") format("woff2")}`).join('');
  const el = document.createElement('style');
  el.dataset.wowFont = '1';
  el.textContent = css;
  document.head.appendChild(el);
}

let loading: Promise<boolean> | null = null;

// 真正把字体加载进来。画任何一帧之前都要 await 它。
// 返回 false 表示没加载成功（网络断了、文件丢了）——这时渲染仍会继续，只是用系统字体，
// 两边就可能不一致。调用方该把这件事说出来，而不是假装无事发生。
export function loadRenderFont(): Promise<boolean> {
  if (loading) return loading;
  if (typeof document === 'undefined' || !document.fonts) return (loading = Promise.resolve(false));
  ensureFontFace();
  loading = Promise.all(FILES.map(f =>
    document.fonts.load(`${f.weight} 64px "${RENDER_FONT}"`).catch(() => [])
  )).then(() => fontReady()).catch(() => false);
  return loading;
}

// 字体到底能不能用了。两个字重都要在
export function fontReady(): boolean {
  if (typeof document === 'undefined' || !document.fonts) return false;
  try { return FILES.every(f => document.fonts.check(`${f.weight} 64px "${RENDER_FONT}"`)); }
  catch { return false; }
}

export const __test = { fontBase, FILES };
