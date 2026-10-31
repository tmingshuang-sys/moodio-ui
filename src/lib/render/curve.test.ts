// 关键帧曲线：逐帧渲染的前提是同一个 t 永远得到同一个值，而且插值不许冲过头
import { describe, expect, it } from 'vitest';
import { envelope, monotone, spring, track, vnoise } from './curve';

describe('关键帧插值', () => {
  it('穿过每一个关键帧', () => {
    const f = monotone([[0, 0], [1, 10], [2, 3]]);
    expect(f(0)).toBeCloseTo(0);
    expect(f(1)).toBeCloseTo(10);
    expect(f(2)).toBeCloseTo(3);
  });

  it('区间外夹住，不外推', () => {
    const f = monotone([[1, 5], [2, 7]]);
    expect(f(-100)).toBe(5);
    expect(f(100)).toBe(7);
  });

  it('不冲过头——这正是不用 Catmull-Rom 的原因', () => {
    const f = monotone([[0, 0], [1, 1], [2, 1], [3, 0]]);
    for (let t = 0; t <= 3; t += 0.01) {
      const v = f(t);
      expect(v).toBeGreaterThanOrEqual(-1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('单调上升的关键帧插出来也单调', () => {
    const f = monotone([[0, 0], [1, 2], [2, 2.1], [3, 9]]);
    let prev = -Infinity;
    for (let t = 0; t <= 3; t += 0.02) { const v = f(t); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
  });

  it('边界情况不炸', () => {
    expect(monotone([])(1)).toBe(0);
    expect(monotone([[0, 4]])(99)).toBe(4);
    expect(track([])(1)).toEqual([]);
  });

  it('多维轨道各维独立插值', () => {
    const cam = track([[0, [0, 0, 1]], [2, [100, 50, 1.4]]]);
    expect(cam(0)).toEqual([0, 0, 1]);
    expect(cam(2)).toEqual([100, 50, 1.4]);
    const mid = cam(1);
    expect(mid[0]).toBeGreaterThan(0); expect(mid[0]).toBeLessThan(100);
    expect(mid[2]).toBeGreaterThan(1); expect(mid[2]).toBeLessThan(1.4);
  });
});

describe('弹簧与包络', () => {
  it('弹簧从 0 起、最终落在 1', () => {
    expect(spring(0)).toBeCloseTo(0, 6);
    expect(spring(6)).toBeCloseTo(1, 2);
  });
  it('包络两头是 0、中间是 1', () => {
    expect(envelope(1, 1, 5)).toBe(0);
    expect(envelope(3, 1, 5)).toBe(1);
    expect(envelope(5, 1, 5)).toBeCloseTo(0, 10);   // 浮点，不强求正好 0
    expect(envelope(1.15, 1, 5)).toBeCloseTo(0.5, 2);
  });
});

describe('值噪声', () => {
  it('确定性：同一个 x 永远同一个值（逐帧导出不闪的前提）', () => {
    expect(vnoise(3.7)).toBe(vnoise(3.7));
    expect(vnoise(3.7)).not.toBe(vnoise(3.8));
  });
  it('落在 0..1', () => {
    for (let x = 0; x < 40; x += 0.37) { expect(vnoise(x)).toBeGreaterThanOrEqual(0); expect(vnoise(x)).toBeLessThanOrEqual(1); }
  });
});
