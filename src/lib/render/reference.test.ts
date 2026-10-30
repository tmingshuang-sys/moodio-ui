// 参考视频分析：配色角色、切点、画幅、字幕带（纯数学部分）
import { describe, expect, it } from 'vitest';
import { contrast, detectCuts, quantize, ratioOf, rolesFrom, styleFromAnalysis, textBandOf } from './reference';

// 造一张「像素图」：按比例铺几种颜色
function pixels(spec: [number[], number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [[r, g, b], n] of spec) for (let i = 0; i < n; i++) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
}

describe('参考视频分析', () => {
  it('对比度按 WCAG 算，黑白是 21:1', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 2);
  });

  it('量化把相近颜色并成一桶，按出现次数排序', () => {
    const q = quantize(pixels([[[250, 250, 248], 100], [[252, 248, 246], 60], [[20, 20, 22], 30], [[200, 40, 30], 10]]));
    expect(q[0].count).toBe(160);                 // 两种相近的米白并成一桶
    expect(Math.round(q[0].r)).toBeGreaterThan(240);
    expect(q.length).toBe(3);
  });

  it('挑出底色 / 字色 / 强调色：底色占比最大，字色对比最高，强调色最鲜艳', () => {
    const p = rolesFrom(quantize(pixels([[[247, 246, 243], 500], [[27, 27, 29], 200], [[198, 52, 31], 60]])));
    expect(p.bg).toMatch(/^#f/i);
    expect(p.dark).toBe(false);
    expect(parseInt(p.fg.slice(1, 3), 16)).toBeLessThan(60);         // 字色是深色
    expect(parseInt(p.accent.slice(1, 3), 16)).toBeGreaterThan(150); // 强调色偏红
  });

  it('暗底片子判成 dark，字色自动取浅色', () => {
    const p = rolesFrom(quantize(pixels([[[13, 15, 18], 500], [[242, 243, 245], 150], [[73, 224, 139], 80]])));
    expect(p.dark).toBe(true);
    expect(parseInt(p.fg.slice(1, 3), 16)).toBeGreaterThan(180);
  });

  it('没有任何颜色时给一套安全的默认值，不抛', () => {
    const p = rolesFrom([]);
    expect(p).toMatchObject({ bg: '#f7f6f3', dark: false });
  });

  it('切点按差值分布定阈值，0.4 秒内不算两刀', () => {
    const diffs = [2, 3, 2, 80, 2, 3, 2, 90, 2];
    const times = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];
    expect(detectCuts(diffs, times)).toEqual([2, 4]);
    expect(detectCuts([5, 5, 5, 5], [1, 2, 3, 4])).toEqual([]);      // 一镜到底没有切点
    expect(detectCuts([1], [1])).toEqual([]);                         // 样本太少不猜
  });

  it('画幅按宽高比归到三档', () => {
    expect(ratioOf(1080, 1920)).toBe('9:16');
    expect(ratioOf(1920, 1080)).toBe('16:9');
    expect(ratioOf(1080, 1080)).toBe('1:1');
  });

  it('字幕带：底部细节明显多就判底部，三条差不多就判没有', () => {
    expect(textBandOf([100, 100, 300])).toBe('bottom');
    expect(textBandOf([100, 400, 100])).toBe('center');
    expect(textBandOf([100, 110, 105])).toBe('none');
  });

  it('分析结果能直接变成画面方案的字段', () => {
    const style = styleFromAnalysis({
      width: 1080, height: 1920, ratio: '9:16', duration: 60,
      palette: { bg: '#0d0f12', fg: '#f2f3f5', accent: '#49e08b', dark: true },
      cuts: [2, 5, 9, 13], avgShot: 3.2, textBand: 'bottom', frames: 60,
    });
    expect(style.ratio).toBe('9:16');
    expect(style.theme).toBe('night');
    expect(style.palette.bg).toBe('#0d0f12');
    expect(style.palette.bg2).not.toBe(style.palette.bg);      // 次级底色是底色往字色方向调出来的
    expect(style.subtitle).toBe(true);
    expect(style.pacing).toBe(3.2);
  });
});
