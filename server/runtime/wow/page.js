// 渲染页的桥：把一份画面方案接到上游的页面契约上。
//   window.DUR      总时长（秒）
//   window.render(t)  画 t 时刻那一帧，必须确定性——我们的 drawFrame 本来就是
//   window.READY    字体与图片就绪
//   window.TEXTS(t) 这一刻屏幕上的文字，给 readcheck 查可读时间
//   window.EV       声音 / 卡点事件，给混音用
// 上游 core/render/ 下的 video.mjs / still.mjs / readcheck.mjs / events.mjs 认的就是这几个全局，
// 所以它们不用改一行就能跑我们的内容；以后模型自己写的风格页只要也满足这份契约，走的是同一条管线。
import { normalizeSpec, timelineOf, slotAt, subtitlesOf, layoutFor, themeFor, drawFrame, loadRenderFont, fontReady } from '/wow/renderer.js';

const qs = new URLSearchParams(location.search);
const specUrl = qs.get('spec') || 'spec.json';

const raw = await (await fetch(specUrl)).json();
const spec = normalizeSpec(raw);
const tl = timelineOf(spec);
const layout = layoutFor(spec.ratio);

const canvas = document.getElementById('stage');
canvas.width = layout.w;
canvas.height = layout.h;
const ctx = canvas.getContext('2d', { alpha: false });
const theme = themeFor(spec.theme, spec.palette);

// 媒体：image 模板引用的图片由任务目录里的 media/<id> 提供（服务端渲染时已经落好盘）
const images = new Map();
for (const id of new Set(spec.beats.map(b => b.mediaId).filter(Boolean))) {
  try {
    const r = await fetch('media/' + id);
    if (r.ok) images.set(id, await createImageBitmap(await r.blob()));
  } catch { /* 缺图按缺图画，不让整条渲染失败 */ }
}

const stage = {
  ctx, spec, tl, layout, theme, images,
  measure: (s, size) => { ctx.font = `700 ${size}px ${theme.display}`; return ctx.measureText(s).width; },
};

window.DUR = tl.total;
window.render = t => drawFrame(stage, t, Math.round(t * spec.fps));

// 字幕也是口播原文，readcheck 不该把它算进去（它的停留时间由这一段的时长决定，不由阅读速度决定）
window.TEXTS = t => {
  const slot = slotAt(tl, t);
  if (!slot) return [];
  const b = slot.beat;
  const parts = [b.heading, b.text, b.left, b.right, b.leftLabel, b.rightLabel, b.value && String(b.value) + (b.unit || ''), ...(b.items || [])];
  const box = { x0: layout.stage.x, y0: layout.stage.y, x1: layout.stage.x + layout.stage.w, y1: layout.stage.y + layout.stage.h };
  return parts.filter(Boolean).map((text, i) => ({ id: `${slot.index}-${i}`, text: String(text), ...box }));
};

// 每段起点一个 cue：混音时配音与拟音按它落点
window.EV = tl.slots.map((s, i) => ({ t: s.start, type: 'beat', i, template: s.beat.template, voiceId: s.beat.voiceId || null }));
window.SUBTITLES = spec.subtitle ? subtitlesOf(spec, tl) : [];

// 字体要显式加载。document.fonts.ready 在这里**不够**：它只等排版引擎请求过的字体，
// 而我们整页只有一个 canvas，没有任何排版，所以它会立刻 resolve，然后第一帧用系统字体画出来。
// 上游的 video.mjs 是等 window.READY 才开始截帧的，所以必须在这之前把字体落实。
await loadRenderFont();
await document.fonts.ready;
if (!fontReady()) {
  // 服务端这边必须喊出来：悄悄用系统字体渲完，成片和用户预览的不一样，而且没人会发现
  console.error('[wow] 自带字体没加载成功，这一条会用系统字体，和浏览器预览不一致');
  window.FONT_MISSING = true;
}
window.render(0);
window.READY = true;
