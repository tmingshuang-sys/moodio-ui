// 片段方案校验：时段相接、片段合计、卖点落地、总时长解析
import { beforeAll, describe, expect, it } from 'vitest';

let parseSeconds: typeof import('./lint')['parseSeconds'];
let activeSellingPoints: typeof import('./lint')['activeSellingPoints'];
let sellingPointRows: typeof import('./lint')['sellingPointRows'];
let lintClipDocs: typeof import('./lint')['lintClipDocs'];
let ledgerRows: typeof import('./lint')['ledgerRows'];
let frozenDescriptions: typeof import('./lint')['frozenDescriptions'];
let songSegments: typeof import('./lint')['songSegments'];
beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  ({ parseSeconds, activeSellingPoints, sellingPointRows, lintClipDocs, ledgerRows, frozenDescriptions, songSegments } = await import('./lint'));
});

const clip = (no: number, seconds: number, ranges: string[], body = '', exposure = '无') => ({ name: `视频生成Prompt-${String(no).padStart(2, '0')}.md`, content: `时长：${seconds}秒，比例：16:9。任务：生成品牌TVC。\n\n${ranges.map(r => `${r}秒\n拍法：固定\n画面内容：${body}\n品牌/产品露出：${exposure}\n声音：{a}`).join('\n')}` });
const ledger = `# 营销脑图\n## 卖点账本\n| 编号 | 卖点 | 优先级 | 篇幅权重 | 内容 | 证明方式 | 落在哪个片段 | 状态 |\n|---|---|---|---|---|---|---|---|\n| USP-01 | 便携轻巧，单手可握 | P00 | 高 | x | y | 2 | 已激活 |\n| SP-01 | 防水设计 | P0 | 中 | x | y | 3 | 已激活 |\n| SP-02 | 长续航 | P1 | 低 | x | y | - | 备选 |\n`;

describe('clip lint', () => {
  it('parses brief durations in the common Chinese forms', () => {
    expect(parseSeconds('60 秒')).toBe(60); expect(parseSeconds('1 分钟')).toBe(60); expect(parseSeconds('3 分 42 秒')).toBe(222); expect(parseSeconds('90s')).toBe(90); expect(parseSeconds('')).toBeNull();
  });
  it('reads only the activated selling points from the ledger table', () => {
    expect(activeSellingPoints(ledger)).toEqual(['便携轻巧，单手可握', '防水设计']);
    expect(sellingPointRows(ledger)).toEqual([{ point: '便携轻巧，单手可握', kind: '卖点', clip: 2, time: undefined }, { point: '防水设计', kind: '卖点', clip: 3, time: undefined }]);
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

describe('genre-neutral checks', () => {
  it('reads any ledger table with a landing column, frozen descriptions and song segments', () => {
    const imagery = '| 编号 | 意象 | 出现的段落 | 画面写法 | 递进方式 | 落在哪个片段 | 状态 |\n|---|---|---|---|---|---|---|\n| IM-01 | 霓虹 | 副歌 | x | y | 3 | 已激活 |\n| IM-02 | 雨 | 主歌 | x | y | - | 备选 |\n';
    expect(ledgerRows(imagery)).toEqual([{ point: '霓虹', kind: '意象', clip: 3, time: undefined }]);
    const bio = '# 人物小传\n\n## 小航（25）\n概况：25 岁\n冻结外形描述：利落黑色板寸短发，纯白圆领 T 恤配浅蓝水洗牛仔裤，清冷平静\n性格：闷\n\n## 阿杰\n冻结外形描述：不出镜\n';
    expect(frozenDescriptions(bio)).toEqual([{ name: '小航', desc: '利落黑色板寸短发，纯白圆领 T 恤配浅蓝水洗牛仔裤，清冷平静' }]);
    const song = '## 段落表\n| 段落 | 起(秒) | 止(秒) | 情绪 | 歌词要点 |\n|---|---|---|---|---|\n| 前奏 | 0 | 15 | 静 | - |\n| 主歌 | 15 | 45 | 孤独 | 街 |\n| 副歌 | 0:45 | 1:10 | 燃 | 走 |\n';
    expect(songSegments(song)).toEqual([{ name: '前奏', start: 0, end: 15 }, { name: '主歌', start: 15, end: 45 }, { name: '副歌', start: 45, end: 70 }]);
  });
  it('enforces frozen descriptions, song-boundary clips and the first hook inside three seconds', () => {
    const desc = '利落黑色板寸短发，纯白圆领 T 恤配浅蓝水洗牛仔裤';
    const docs = [
      { name: '视频生成Prompt-01.md', content: `时长：15秒，比例：16:9。任务：MV 段落。\nfull-film range: 0-15s / part 1 of 2\n主体1：小航，${desc}，对应@图片1\n\n0-15秒\n拍法：固定\n画面内容：小航走在街头\n意象与歌词对位：霓虹\n声音：{a}` },
      { name: '视频生成Prompt-02.md', content: '时长：15秒，比例：16:9。任务：MV 段落。\nfull-film range: 15-30s / part 2 of 2\n主体1：小航，短发\n\n0-15秒\n拍法：固定\n画面内容：小航淋雨\n意象与歌词对位：雨\n声音：{a}' },
    ];
    const r = lintClipDocs(docs, [{ point: '霓虹', kind: '意象', clip: 1 }], 30, { frozen: [{ name: '小航', desc }], segments: [{ name: '前奏', start: 0, end: 15 }, { name: '主歌', start: 15, end: 45 }], hooks: [{ point: '反差画面', kind: '钩子', time: 5, clip: 2 }] });
    expect(r.errors).toEqual(expect.arrayContaining([expect.stringContaining('「视频生成Prompt-02.md」提到了「小航」，但没有原样使用'), expect.stringContaining('15-30s 没有落在歌曲段落边界'), expect.stringContaining('在 5 秒，必须在 3 秒以内'), expect.stringContaining('落在第 2 段，必须在第 1 段')]));
    expect(r.errors.some(e => e.includes('Prompt-01.md」提到了'))).toBe(false);
    expect(r.errors.some(e => e.includes('意象「霓虹」'))).toBe(false);
  });
});
