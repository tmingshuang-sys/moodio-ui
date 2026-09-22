// 成片合成里不依赖浏览器媒体接口的部分：字幕折行与时间轴查找
import { beforeAll, describe, expect, it } from 'vitest';

let wrapSubtitle: typeof import('./compose')['wrapSubtitle'];
let activeSubtitle: typeof import('./compose')['activeSubtitle'];
beforeAll(async () => {   // compose 依赖仓库模块，仓库在加载时会碰 document / localStorage，先打桩
  (globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  ({ wrapSubtitle, activeSubtitle } = await import('./compose'));
});

describe('subtitles', () => {
  it('wraps long lines at punctuation or spaces and keeps at most two lines', () => {
    expect(wrapSubtitle('雨夜街头，一盏红灯笼', 20)).toEqual(['雨夜街头，一盏红灯笼']);
    expect(wrapSubtitle('这个音箱只有手掌大小，却陪你走遍每一条街，下雨也不怕', 12)).toEqual(['这个音箱只有手掌大小，', '却陪你走遍每一条街，']);
    expect(wrapSubtitle('a red lantern swaying in the night rain of the city', 16).length).toBe(2);
    expect(wrapSubtitle('   ', 10)).toEqual([]);
  });
  it('finds the subtitle active at a time on the film timeline', () => {
    const subs = [{ start: 0, end: 3, text: 'a' }, { start: 3, end: 6.5, text: 'b' }];
    expect(activeSubtitle(subs, 0)?.text).toBe('a'); expect(activeSubtitle(subs, 2.99)?.text).toBe('a');
    expect(activeSubtitle(subs, 3)?.text).toBe('b'); expect(activeSubtitle(subs, 6.5)).toBeNull(); expect(activeSubtitle(undefined, 1)).toBeNull();
  });
});
