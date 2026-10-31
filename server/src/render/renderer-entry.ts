// 服务端渲染页的入口：把前端渲染核心原样再导出一遍，不复制任何逻辑。
// 改 src/lib/render/* 之后跑一次 npm run build:renderer，服务端立刻跟上。
export { normalizeSpec, timelineOf, slotAt, subtitlesOf, lintSpec, estimateSeconds } from '../../../src/lib/render/spec';
export type { SceneSpec, Beat, Timeline } from '../../../src/lib/render/spec';
export { layoutFor, themeFor } from '../../../src/lib/render/theme';
export { drawFrame } from '../../../src/lib/render/paint';
export type { Stage } from '../../../src/lib/render/paint';
// 自带字体：浏览器和这里加载同一个 woff2，字形与字宽才一致（见 src/lib/render/fonts.ts 开头）
export { loadRenderFont, fontReady, ensureFontFace, RENDER_FONT } from '../../../src/lib/render/fonts';
