// 等待时间预期：样本记录、中位数、友好的时长文案
import { beforeEach, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
const { recordRound, expectedMs, humanDuration } = await import('./timing');

describe('timing', () => {
  beforeEach(() => memory.clear());
  it('keeps the last rounds and reports the median once there are enough samples', () => {
    expect(expectedMs('plan')).toBe(30_000);                       // 没样本时用兜底值
    recordRound('plan', 20_000);
    expect(expectedMs('plan')).toBe(25_000);                       // 样本少：和兜底值各取一半
    recordRound('plan', 22_000); recordRound('plan', 18_000);
    expect(expectedMs('plan')).toBe(20_000);                       // 三个样本起取中位数
    recordRound('plan', 500); recordRound('plan', 60 * 60_000);    // 太短太长都不计
    expect(expectedMs('plan')).toBe(20_000);
    for (let i = 0; i < 12; i++) recordRound('write', 40_000 + i * 1000);
    expect(JSON.parse(memory.get('moodio-timing-v1')!).write.length).toBe(8);
  });
  it('writes durations the way a person reads them', () => {
    expect(humanDuration(45_000)).toBe('45 秒');
    expect(humanDuration(80_000)).toBe('1 分 20 秒');
    expect(humanDuration(120_000)).toBe('2 分钟');
    expect(humanDuration(45_000, true)).toBe('45s');
    expect(humanDuration(80_000, true)).toBe('1m 20s');
    expect(humanDuration(37_000, false, true)).toBe('35 秒');      // 预期值取整，不做假精确
    expect(humanDuration(97_000, false, true)).toBe('1 分 40 秒');
  });
});
