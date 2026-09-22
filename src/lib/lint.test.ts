// 片段方案校验：时段相接、片段合计、卖点落地、总时长解析
import { beforeAll, describe, expect, it } from 'vitest';

let parseSeconds: typeof import('./lint')['parseSeconds'];
let activeSellingPoints: typeof import('./lint')['activeSellingPoints'];
let sellingPointRows: typeof import('./lint')['sellingPointRows'];
let lintClipDocs: typeof import('./lint')['lintClipDocs'];
beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  ({ parseSeconds, activeSellingPoints, sellingPointRows, lintClipDocs } = await import('./lint'));
});

const clip = (no: number, seconds: number, ranges: string[], body = '', exposure = '无') => ({ name: `视频生成Prompt-${String(no).padStart(2, '0')}.md`, content: `时长：${seconds}秒，比例：16:9。任务：生成品牌TVC。\n\n${ranges.map(r => `${r}秒\n拍法：固定\n画面内容：${body}\n品牌/产品露出：${exposure}\n声音：{a}`).join('\n')}` });
const ledger = `# 营销脑图\n## 卖点账本\n| 编号 | 卖点 | 优先级 | 篇幅权重 | 内容 | 证明方式 | 落在哪个片段 | 状态 |\n|---|---|---|---|---|---|---|---|\n| USP-01 | 便携轻巧，单手可握 | P00 | 高 | x | y | 2 | 已激活 |\n| SP-01 | 防水设计 | P0 | 中 | x | y | 3 | 已激活 |\n| SP-02 | 长续航 | P1 | 低 | x | y | - | 备选 |\n`;

describe('clip lint', () => {
  it('parses brief durations in the common Chinese forms', () => {
    expect(parseSeconds('60 秒')).toBe(60); expect(parseSeconds('1 分钟')).toBe(60); expect(parseSeconds('3 分 42 秒')).toBe(222); expect(parseSeconds('90s')).toBe(90); expect(parseSeconds('')).toBeNull();
  });
  it('reads only the activated selling points from the ledger table', () => {
    expect(activeSellingPoints(ledger)).toEqual(['便携轻巧，单手可握', '防水设计']);
    expect(sellingPointRows(ledger)).toEqual([{ point: '便携轻巧，单手可握', clip: 2 }, { point: '防水设计', clip: 3 }]);
  });
  it('flags gaps, wrong totals and selling points that never land, and passes a consistent plan', () => {
    const bad = lintClipDocs([clip(1, 15, ['0-4', '4-11'], '小航戴耳机'), clip(2, 15, ['0-6', '7-15'], '单手握住音箱')], ['便携轻巧，单手可握', '防水设计'], 60);
    expect(bad.errors).toEqual(expect.arrayContaining([expect.stringContaining('只排到 11 秒'), expect.stringContaining('与前一段不相接'), expect.stringContaining('卖点「防水设计」')]));
    expect(bad.errors.some(e => e.includes('便携轻巧'))).toBe(true);   // 只有「单手」一个碎词、账本又没写片段 → 不算落地
    expect(bad.warnings).toEqual(expect.arrayContaining([expect.stringContaining('合计 30 秒')]));
    const good = lintClipDocs([clip(1, 15, ['0-7', '7-15'], '小航掏出音箱', '产品1在掌心，单手握住，比手掌略小'), clip(2, 15, ['0-15'], '雨中街道', '产品1淋雨仍在播放，证明防水')], ['便携轻巧，单手可握', '防水设计'], 30);
    expect(good.errors).toEqual([]); expect(good.warnings).toEqual([]);
    // 账本里写清「落在哪个片段」且那段存在，就认它落地
    const byLedger = lintClipDocs([clip(1, 15, ['0-15'], '街头'), clip(2, 15, ['0-15'], '掌心')], [{ point: '便携轻巧，单手可握', clip: 2 }, { point: '防水设计', clip: 9 }], 30);
    expect(byLedger.errors).toEqual([expect.stringContaining('卖点「防水设计」')]);
    expect(lintClipDocs([{ name: '故事脚本.md', content: 'x' }], [], 60).errors[0]).toContain('还没有片段提示词');
  });
});
