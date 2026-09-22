// ===== 全局布局偏好：侧栏宽度、侧栏里导航区与创作历史之间分界线的位置（跨项目共用，存 localStorage moodio-layout-v1）=====
// 右侧工作区的宽度是每个项目自己的（useFiles.ui.paneWidth），这里只管侧栏。
import { create } from 'zustand';
import { readJSON, writeJSON } from './storage';

export const SIDEBAR_DEFAULT = 280, SIDEBAR_MIN = 200, SIDEBAR_MAX = 440;
export const NAV_MIN = 96;   // 导航区至少放下「创作 / 资源」两项；0 = 跟随内容高度
const KEY = 'moodio-layout-v1';
interface LayoutPrefs { sidebarWidth: number; navHeight: number; }
interface LayoutState extends LayoutPrefs { setSidebarWidth(px: number): void; setNavHeight(px: number, max?: number): void; reset(part: 'sidebar' | 'nav'): void; }

export const clampSidebar = (px: number) => Math.round(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, px || SIDEBAR_DEFAULT)));
export const clampNav = (px: number, max = Infinity) => (px <= 0 ? 0 : Math.round(Math.max(NAV_MIN, Math.min(max, px))));
const load = (): LayoutPrefs => { const s = readJSON<Partial<LayoutPrefs>>(KEY, {}); return { sidebarWidth: clampSidebar(Number(s.sidebarWidth) || SIDEBAR_DEFAULT), navHeight: clampNav(Number(s.navHeight) || 0) }; };
const persist = (get: () => LayoutState) => { const { sidebarWidth, navHeight } = get(); writeJSON(KEY, { sidebarWidth, navHeight }); };

export const useLayout = create<LayoutState>((set, get) => ({
  ...load(),
  setSidebarWidth(px) { set({ sidebarWidth: clampSidebar(px) }); persist(get); },
  setNavHeight(px, max) { set({ navHeight: clampNav(px, max) }); persist(get); },
  reset(part) { set(part === 'sidebar' ? { sidebarWidth: SIDEBAR_DEFAULT } : { navHeight: 0 }); persist(get); },
}));
