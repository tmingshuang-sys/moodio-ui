// 画面方案：规整、按口播估时、时间轴、字幕与自检
import { describe, expect, it } from 'vitest';
import { estimateSeconds, lintSpec, normalizeSpec, parseSpec, subtitlesOf, timelineOf, readingSeconds } from './spec';
import { fitSize, roughMeasure, subtitleLines, wrapText } from './text';

const beat = (say: string, template = 'bullets', extra: Record<string, unknown> = {}) => ({ say, template, ...extra });

describe('画面方案', () => {
  it('按中文字数估口播时长，极短极长都收敛到范围内', () => {
    expect(estimateSeconds('')).toBe(1.2);
    expect(estimateSeconds('你有没有想过')).toBeCloseTo(1.6, 1);          // 6 字 / 4.8 + 0.35
    expect(estimateSeconds('说白了就一句话，不停地猜，然后纠错')).toBeGreaterThan(3);
    expect(estimateSeconds('啊'.repeat(400))).toBe(20);                   // 上限
    expect(estimateSeconds('gradient descent learning rate')).toBeGreaterThan(1.2);
  });

  it('规整时补齐默认值、丢掉不认识的模板、按 say 估时', () => {
    const spec = normalizeSpec({ title: '梯度下降', beats: [beat('第一句话'), { say: '第二句', template: '乱写的' }] });
    expect(spec.ratio).toBe('9:16');
    expect(spec.fps).toBe(30);
    expect(spec.theme).toBe('ink');
    expect(spec.subtitle).toBe(true);
    expect(spec.beats[1].template).toBe('bullets');                       // 不认识的模板退到 bullets
    expect(spec.beats[0].seconds).toBeGreaterThan(0);
  });

  it('时间轴首尾相接，字幕起止就是各段起止', () => {
    const spec = normalizeSpec({ title: 'x', beats: [beat('一句', 'hook', { seconds: 3 }), beat('二句', 'bullets', { seconds: 4, items: ['a'] }), beat('', 'image', { seconds: 2, mediaId: 'm1' })] });
    const tl = timelineOf(spec);
    expect(tl.total).toBe(9);
    expect(tl.slots.map(s => [s.start, s.end])).toEqual([[0, 3], [3, 7], [7, 9]]);
    const subs = subtitlesOf(spec, tl);
    expect(subs).toHaveLength(2);                                          // 没有 say 的那段不出字幕
    expect(subs[1]).toEqual({ start: 3, end: 7, text: '二句' });
  });

  it('自检能抓出缺字段、一屏太多条、全片只有一种模板、第一段不是钩子', () => {
    const bad = normalizeSpec({ title: 'x', beats: [beat('开头', 'bullets', { items: ['a'] }), beat('缺 items', 'bullets'), beat('五条', 'bullets', { items: ['a', 'b', 'c', 'd', 'e'] })] });
    const issues = lintSpec(bad).join('\n');
    expect(issues).toMatch('第 1 段不是 hook');
    expect(issues).toMatch('第 2 段用了 bullets 但没写 items');
    expect(issues).toMatch('一屏最多 4 条');
    expect(issues).toMatch('太短');
    const long = normalizeSpec({ title: 'x', beats: Array.from({ length: 8 }, () => beat('这句话有十二个字啦啦啦', 'bullets', { items: ['a'] })) });
    expect(lintSpec(long).join('\n')).toMatch('不到 3 种画面模板');
  });

  it('一句口播超过 40 字要被拦下来', () => {
    const spec = normalizeSpec({ title: 'x', beats: [beat('啊'.repeat(45), 'hook')] });
    expect(lintSpec(spec).join('\n')).toMatch('超过 40 字');
  });

  it('坏 JSON 返回 null，不抛', () => {
    expect(parseSpec('{ 不是 json')).toBeNull();
    expect(parseSpec('[]')).not.toBeNull();        // 数组也是对象，规整成空 beats
  });
});

describe('文字排版', () => {
  it('中文按字断行，避头尾不把标点甩到行首', () => {
    const lines = wrapText('机器学习说白了，就是不停地猜然后纠错。', 40, 40 * 8, roughMeasure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every(l => !'，。'.includes(l[0]))).toBe(true);
  });

  it('英文按空格断行，超长单词硬断', () => {
    expect(wrapText('gradient descent learning rate', 40, 40 * 6, roughMeasure).length).toBeGreaterThan(1);
    const hard = wrapText('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 40, 40 * 4, roughMeasure);
    expect(hard.length).toBeGreaterThan(1);
  });

  it('自动字号：排不进去就一路缩到能排进去', () => {
    const big = fitSize('四个字', 400, 1, roughMeasure, 200);
    expect(big.size).toBeLessThanOrEqual(133);
    expect(big.lines).toEqual(['四个字']);
    const small = fitSize('这是一句相当长的标题需要缩小字号才排得下', 400, 2, roughMeasure, 200);
    expect(small.lines.length).toBeLessThanOrEqual(2);
  });

  it('字幕最多两行，优先在最靠中间的标点处断', () => {
    expect(subtitleLines('很短一句', 50, 1000, roughMeasure)).toEqual(['很短一句']);
    const two = subtitleLines('说白了就一句话，不停地猜然后纠错', 50, 50 * 9, roughMeasure);
    expect(two).toHaveLength(2);
    expect(two[0].endsWith('，')).toBe(true);
    expect(subtitleLines('啊'.repeat(60), 50, 50 * 9, roughMeasure).length).toBeLessThanOrEqual(2);
  });
});

describe('可读时间', () => {
  const beat = (extra: any) => ({ say: '一句口播', template: 'bullets', seconds: 3, ...extra });

  it('只算画面上的字，不算字幕（字幕就是口播，时长由这一段决定）', () => {
    expect(readingSeconds(beat({ say: '这是一句很长很长很长很长的口播稿子' }) as any)).toBe(0);
  });

  it('汉字按 4.5 字/秒、拉丁按 15 字/秒，各加 1.5 秒余量', () => {
    expect(readingSeconds(beat({ heading: '九个字的小标题啊' }) as any)).toBeCloseTo(8 / 4.5 + 1.5, 2);
    expect(readingSeconds(beat({ text: 'abcdefghijklmno' }) as any)).toBeCloseTo(15 / 15 + 1.5, 2);
  });

  it('一屏多块文字是加起来算的，不是各算各的', () => {
    const one = readingSeconds(beat({ items: ['四个字啊'] }) as any);
    const four = readingSeconds(beat({ items: ['四个字啊', '四个字啊', '四个字啊', '四个字啊'] }) as any);
    expect(four).toBeGreaterThan(one * 2);
  });

  it('字太多而这一段太短会被 lint 拦下来', () => {
    const spec = normalizeSpec({
      title: 't', ratio: '9:16', theme: 'ink',
      beats: [
        { say: '钩子', template: 'hook', text: '钩子', seconds: 3 },
        { say: '短', template: 'term', heading: '术语', text: '这里塞了整整一长串需要很久才能读完的解释文字', seconds: 1.5 },
      ],
    });
    const issues = lintSpec(spec);
    expect(issues.some(x => x.includes('才读得完'))).toBe(true);
  });

  it('字少、时间够就不报', () => {
    const b = normalizeSpec({ title: 't', beats: [{ say: '短句', template: 'hook', text: '四个字啊', seconds: 6 }] }).beats[0];
    expect(readingSeconds(b)).toBeLessThan(6);
  });
});
