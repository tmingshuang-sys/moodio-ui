// 布局偏好：侧栏宽度与导航区高度的范围与持久化
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let layout: typeof import('./layout');
beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  layout = await import('./layout');
});

describe('layout prefs', () => {
  it('clamps the sidebar width and remembers it', () => {
    expect(layout.clampSidebar(0)).toBe(280); expect(layout.clampSidebar(100)).toBe(200); expect(layout.clampSidebar(999)).toBe(440);
    layout.useLayout.getState().setSidebarWidth(333); expect(layout.useLayout.getState().sidebarWidth).toBe(333);
    expect(JSON.parse(memory.get('moodio-layout-v1')!).sidebarWidth).toBe(333);
    layout.useLayout.getState().reset('sidebar'); expect(layout.useLayout.getState().sidebarWidth).toBe(280);
  });
  it('keeps the nav split above its minimum and allows auto (0)', () => {
    expect(layout.clampNav(0)).toBe(0); expect(layout.clampNav(40)).toBe(96); expect(layout.clampNav(500, 300)).toBe(300);
    layout.useLayout.getState().setNavHeight(220, 600); expect(layout.useLayout.getState().navHeight).toBe(220);
    layout.useLayout.getState().reset('nav'); expect(layout.useLayout.getState().navHeight).toBe(0);
  });
});
