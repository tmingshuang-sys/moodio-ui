// ===== 风格模板：一条片子的配色、字体、版式尺寸 =====
// 画面好不好看，八成由这里决定；模板里的每个颜色都成套调过，模型只需要选一个 theme id，不要自己配色。
// 想换成某个参考视频的观感时，用 analyze_reference 产出的「风格模板.json」覆盖 palette 字段即可。
import type { SceneRatio } from './spec';

export interface Palette {
  bg: string;        // 底色
  bg2: string;       // 次级底色（面板、分栏）
  fg: string;        // 正文字色
  dim: string;       // 次要字色
  accent: string;    // 强调色（数字、下划线、要点标号）
  accent2: string;   // 第二强调色（对比的另一边、图表第二组）
  line: string;      // 分割线与描边
  sub: string;       // 字幕字色
  subBg: string;     // 字幕底条
}
export interface Theme { id: string; name: string; palette: Palette; grain: number; display: string; body: string; mono: string; }

// 中英混排都用系统字体：Mac 上 PingFang 的字重齐，不依赖网络字体（离线也能渲染，不会出现字体没加载完就开始画的闪烁）
const DISPLAY = '"PingFang SC","Hiragino Sans GB","Source Han Sans SC","Noto Sans SC","Microsoft YaHei",system-ui,sans-serif';
const BODY = DISPLAY;
const MONO = '"SF Mono","JetBrains Mono",ui-monospace,"Menlo",monospace';

export const THEMES: Record<string, Theme> = {
  ink: {
    id: 'ink', name: '墨白（克制知识感）', grain: 0.045, display: DISPLAY, body: BODY, mono: MONO,
    palette: { bg: '#f7f6f3', bg2: '#eceae4', fg: '#1b1b1d', dim: '#6f6d68', accent: '#c6341f', accent2: '#1f4f8f', line: '#d6d3cb', sub: '#ffffff', subBg: 'rgba(22,22,24,0.82)' },
  },
  night: {
    id: 'night', name: '深夜（科技感）', grain: 0.06, display: DISPLAY, body: BODY, mono: MONO,
    palette: { bg: '#0d0f12', bg2: '#171a1f', fg: '#f2f3f5', dim: '#8b9099', accent: '#49e08b', accent2: '#5aa9ff', line: '#262a31', sub: '#ffffff', subBg: 'rgba(0,0,0,0.6)' },
  },
  paper: {
    id: 'paper', name: '纸感（人文温和）', grain: 0.08, display: DISPLAY, body: BODY, mono: MONO,
    palette: { bg: '#f3ece0', bg2: '#e7ddcb', fg: '#2e2620', dim: '#7c6f60', accent: '#d2691e', accent2: '#4f7a5c', line: '#d8cbb5', sub: '#ffffff', subBg: 'rgba(46,38,32,0.8)' },
  },
  campus: {
    id: 'campus', name: '学院（课程感）', grain: 0.05, display: DISPLAY, body: BODY, mono: MONO,
    palette: { bg: '#10213f', bg2: '#192d52', fg: '#f4f7fb', dim: '#9fb2cd', accent: '#ffc83d', accent2: '#5fd0c5', line: '#28406a', sub: '#ffffff', subBg: 'rgba(6,14,28,0.72)' },
  },
  pop: {
    id: 'pop', name: '高饱和（网感）', grain: 0.05, display: DISPLAY, body: BODY, mono: MONO,
    palette: { bg: '#f4efe4', bg2: '#ffffff', fg: '#121212', dim: '#6b6660', accent: '#ff4a1c', accent2: '#2b35f0', line: '#ded7c7', sub: '#ffffff', subBg: 'rgba(18,18,18,0.86)' },
  },
};
export const THEME_IDS = Object.keys(THEMES);
export function themeFor(id?: string, override?: Record<string, string>): Theme {
  const base = THEMES[String(id || '')] || THEMES.ink;
  if (!override || !Object.keys(override).length) return base;
  return { ...base, palette: { ...base.palette, ...override } as Palette };
}

// ===== 版式：按画幅给出画布尺寸、安全区与字号基准 =====
export interface Layout {
  w: number; h: number;
  pad: number;            // 左右安全边
  headTop: number;        // 顶部进度条基线
  stage: { x: number; y: number; w: number; h: number };   // 主内容区
  subY: number;           // 字幕基线
  scale: number;          // 字号总体缩放（以 1080 宽为 1）
}
export function layoutFor(ratio: SceneRatio): Layout {
  if (ratio === '16:9') {
    const w = 1920, h = 1080, pad = 140;
    return { w, h, pad, headTop: 56, stage: { x: pad, y: 150, w: w - pad * 2, h: 640 }, subY: h - 92, scale: 1.05 };
  }
  if (ratio === '1:1') {
    const w = 1080, h = 1080, pad = 96;
    return { w, h, pad, headTop: 46, stage: { x: pad, y: 150, w: w - pad * 2, h: 660 }, subY: h - 96, scale: 1 };
  }
  const w = 1080, h = 1920, pad = 84;   // 9:16 默认：上面留标题与进度，中间主舞台，下面留两行字幕
  return { w, h, pad, headTop: 72, stage: { x: pad, y: 330, w: w - pad * 2, h: 1080 }, subY: h - 300, scale: 1 };
}
