// 科普流水线的导演：从选类型一路走到交付，每一步只给唯一的下一步
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let director: typeof import('./director');
let store: typeof import('./store');
let ledger: typeof import('./ledger');
let ex: typeof import('./director-explainer');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  memory.set('moodio-project-fresh::x', '1');
  director = await import('./director'); store = await import('./store'); ledger = await import('./ledger'); ex = await import('./director-explainer');
  store.useFiles.getState().docs.forEach(d => store.useFiles.getState().removeDoc(d.id));
});
const files = () => store.useFiles.getState();

// 一份能过 lintNarration 的口播稿：句句短、没有套话、第一句是问句
const NARRATION = ['AI 到底是怎么学会的？｜大字问句', '说白了就是不停地猜。｜要点', '猜错了就往回改一点。｜要点', '这个步子有多大，叫学习率。｜术语卡', '步子太大会错过谷底。｜对比', '关注我，下期讲反向传播。｜结尾卡'].join('\n');
// 对应的画面方案：每句一个 beat，首 hook 尾 endcard，模板够多样
const SPEC = (voiced: boolean) => JSON.stringify({
  title: '学习率是什么', no: 1, ratio: '9:16', theme: 'ink',
  beats: [
    { say: 'AI 到底是怎么学会的？', template: 'hook', text: 'AI 怎么学会的？', seconds: 3, voiceId: voiced ? 'v1' : undefined },
    { say: '说白了就是不停地猜。', template: 'bullets', items: ['先猜一个', '看错多少'], seconds: 3, voiceId: voiced ? 'v2' : undefined },
    { say: '猜错了就往回改一点。', template: 'steps', items: ['算误差', '改参数'], seconds: 3, voiceId: voiced ? 'v3' : undefined },
    { say: '这个步子有多大，叫学习率。', template: 'term', heading: '学习率', text: '每次往回改多少', seconds: 4, voiceId: voiced ? 'v4' : undefined },
    { say: '步子太大会错过谷底。', template: 'compare', left: '一脚跨过去', right: '稳稳走下去', seconds: 4, voiceId: voiced ? 'v5' : undefined },
    { say: '关注我，下期讲反向传播。', template: 'endcard', text: '下期：反向传播', seconds: 3, voiceId: voiced ? 'v6' : undefined },
  ],
});

describe('科普导演', () => {
  it('选了科普类型后先问通用问卷，答完进入课程转写', () => {
    expect(director.nextStep().kind).toBe('start');
    director.chooseFormat('explainer');
    expect(files().brief.format).toBe('explainer');
    expect(director.nextStep()).toMatchObject({ stage: 'brief', kind: 'ask' });
    const step = director.nextStep();
    expect(step.questions!.some(q => q.key === 'source')).toBe(true);
    expect(step.questions!.some(q => q.key === 'look')).toBe(false);      // 代码渲染不问画风
    ledger.updateLedger({ answers: { source: '一个课程 / 视频链接', audience: '完全零基础', duration: '60 秒', ratio: '竖屏 9:16', theme: '墨白', count: '先做 1 条看效果' } });
    director.applyAnswersToBrief({ audience: '完全零基础', duration: '60 秒', ratio: '竖屏 9:16' });
    expect(director.tick()).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('source');
  });

  it('转写阶段按用户选的来源给出不同的做法，有转写稿才往下走', () => {
    const step = director.nextStep();
    expect(step).toMatchObject({ stage: 'source', kind: 'agent' });
    expect(step.prompt).toMatch('yt-dlp');                                 // 用户选的是链接
    expect(director.tick()).toBe(false);
    files().addDoc({ name: '转写稿-CS229.md', content: '# 转写稿：CS229\n\n## [0:00]\n\n[0:03] Welcome to CS229.\n' });
    expect(director.tick()).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('knowledge');
  });

  it('知识点阶段先 extract_points，再定选题，选题要用户确认', () => {
    expect(director.nextStep().prompt).toMatch('extract_points');
    files().addDoc({ name: '知识点清单.md', content: '| 编号 | 知识点 |\n|---|---|\n| 01 | 学习率 |\n' });
    expect(director.nextStep().label).toMatch('定选题');
    files().addDoc({ name: '选题排期.md', content: '| 顺序 | 编号 | 标题 | 钩子一句话 |\n|---|---|---|---|\n| 1 | 01 | 学习率是什么 | AI 到底怎么学会的？|\n' });
    expect(ex.plannedTopics()).toEqual([{ no: 1, title: '学习率是什么', hook: 'AI 到底怎么学会的？' }]);
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'plan' });
    expect(director.tick()).toBe(false);                                   // 没确认不推进
    director.confirmCheckpoint('plan');
    expect(ledger.readLedger()!.stage).toBe('script');
  });

  it('口播稿有 AI 味就先让它改，改好并确认才进画面方案', () => {
    expect(director.nextStep().label).toMatch('写第 1 条口播稿');
    files().addDoc({ name: '口播-01.md', content: '在当今人工智能飞速发展的时代，我们可以看到机器学习起到了重要作用。\n综上所述，学习率非常重要。' });
    const bad = director.nextStep();
    expect(bad.label).toMatch('修正第 1 条口播稿');
    expect(bad.prompt).toMatch('AI 味');
    expect(director.tick()).toBe(false);
    files().updateDoc(files().docs.find(d => d.name === '口播-01.md')!.id, { content: NARRATION });
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'script' });
    director.confirmCheckpoint('script');
    expect(ledger.readLedger()!.stage).toBe('scene');
  });

  it('画面方案不合格会被拦下，合格后进入配音', () => {
    expect(director.nextStep().label).toMatch('写第 1 条画面方案');
    files().addDoc({ name: '画面-01.json', content: JSON.stringify({ title: 'x', beats: [{ say: '只有一段', template: 'bullets' }] }), kind: 'json' });
    expect(director.nextStep().label).toMatch('修正第 1 条画面方案');
    files().updateDoc(files().docs.find(d => d.name === '画面-01.json')!.id, { content: SPEC(false) });
    expect(director.tick()).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('narrate');
    expect(ex.unvoiced(1)).toBe(6);
  });

  it('逐句配好音后进入渲染，渲完进入成片检查', () => {
    expect(director.nextStep()).toMatchObject({ stage: 'narrate', kind: 'agent', billable: true });
    expect(director.nextStep().prompt).toMatch('narrate_scene');
    files().updateDoc(files().docs.find(d => d.name === '画面-01.json')!.id, { content: SPEC(true) });
    expect(ex.unvoiced(1)).toBe(0);
    expect(director.tick()).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('render');
    const step = director.nextStep();
    expect(step.label).toMatch('渲染第 1 条');
    expect(step.billable).toBeFalsy();                                     // 代码渲染不计费
    expect(director.tick()).toBe(false);
  });

  it('跳过配音时从画面方案直接跳到渲染', async () => {
    const saved = ledger.readLedger()!;
    ledger.updateLedger({ stage: 'scene', flags: { skipVoice: true } });
    expect(director.nextStep().label).toMatch('跳过配音');
    expect(director.tick()).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('render');
    ledger.updateLedger({ stage: saved.stage, flags: { skipVoice: false } });
  });

  it('每个阶段的「还剩几步」按科普自己的九步算', () => {
    ledger.updateLedger({ stage: 'brief' });
    expect(director.nextStep().remaining).toBe(8);
    ledger.updateLedger({ stage: 'render' });
    expect(director.nextStep().remaining).toBe(2);
    ledger.updateLedger({ stage: 'deliver' });
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'deliver', remaining: 0 });
    director.confirmCheckpoint('deliver');
    expect(director.nextStep().kind).toBe('done');
  });
});
