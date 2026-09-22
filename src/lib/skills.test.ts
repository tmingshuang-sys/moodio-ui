// 创作流程包与台账：按类型选技能、阶段骨架一致、问卷题库、台账合并与阶段推进、系统提示里的流程块
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let skills: typeof import('./skills');
let ledger: typeof import('./ledger');
let store: typeof import('./store');
let prompt: typeof import('./agent/prompt');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  skills = await import('./skills'); ledger = await import('./ledger'); store = await import('./store'); prompt = await import('./agent/prompt');
});

describe('skill packs', () => {
  it('has one pack per creative format with the same eight-stage skeleton', () => {
    for (const id of ['ad', 'film', 'series', 'short', 'mv', 'other']) {
      const s = skills.skillFor(id); expect(s.id).toBe(id);
      expect(skills.skillStages(s).map(x => x.id)).toEqual(skills.STAGE_ORDER);
      expect(s.general.length).toBeGreaterThanOrEqual(3); expect(s.modeling.length).toBeGreaterThanOrEqual(2);
      expect(s.contracts.length).toBeGreaterThanOrEqual(1); expect(s.modelDocs.length).toBeGreaterThanOrEqual(1);
      for (const q of [...s.general, ...s.modeling]) { expect(q.key).toBeTruthy(); expect(q.text).toBeTruthy(); if (q.type !== 'text') expect(q.options.length).toBeGreaterThan(1); else expect(q.placeholder).toBeTruthy(); }
    }
    expect(skills.skillFor('nope').id).toBe('other');
    expect(skills.skillFor('ad').name).toBe('营销视频大师'); expect(skills.skillFor('mv').modelDocs).toContain('歌曲分析.md');
    expect(skills.skillStages(skills.skillFor('ad'))[1].name).toBe('商品建模');
    expect(skills.skillStages(skills.skillFor('film'))[1].name).toBe('人物与世界建模');
  });
});

describe('ledger', () => {
  it('is created once per creation, merges patches and advances stages in order', () => {
    expect(ledger.readLedger()).toBeNull();
    store.useFiles.getState().setBrief({ format: 'ad', duration: '60 秒' });
    const first = ledger.ensureLedger('ad'); expect(first.created).toBe(true); expect(first.ledger.skill).toBe('ad'); expect(first.ledger.stage).toBe('brief');
    expect(ledger.ensureLedger('ad').created).toBe(false);
    expect(store.useFiles.getState().docs.some(d => d.name === '台账.json')).toBe(true);
    let l = ledger.updateLedger({ answers: { brand: 'SoundBox Mini', size: '手掌大小' } });
    expect(l.answers).toEqual({ brand: 'SoundBox Mini', size: '手掌大小' });
    l = ledger.updateLedger({ stage: 'script', answers: { color: '哑光黑' } });
    expect(l.stage).toBe('script'); expect(l.done).toEqual(['brief', 'model']); expect(Object.keys(l.answers)).toEqual(['brand', 'size', 'color']);
    l = ledger.updateLedger({ entities: [{ name: '音箱', kind: '产品', status: '待确认' }, { name: '小航', kind: '人物' }] });
    l = ledger.updateLedger({ entities: [{ name: '音箱', ref: 'm1', status: '已确认' }] });
    expect(l.entities).toEqual([{ name: '音箱', kind: '产品', ref: 'm1', status: '已确认' }, { name: '小航', kind: '人物', ref: undefined, status: undefined }]);
    l = ledger.updateLedger({ clips: [{ no: 2, seconds: 15 }, { no: 1, seconds: 15, shots: '01-04' }] });
    l = ledger.updateLedger({ clips: [{ no: 1, mediaId: 'v1', status: '已生成' }] });
    expect(l.clips.map(c => [c.no, c.seconds, c.mediaId])).toEqual([[1, 15, 'v1'], [2, 15, undefined]]);   // 补 mediaId 不会把秒数冲掉
    expect(ledger.updateLedger({ stage: 'bogus' } as any).stage).toBe('script');   // 非法阶段忽略
    const text = ledger.ledgerText(ledger.readLedger()!);
    expect(text).toContain('脚本（当前）'); expect(text).toContain('需求澄清 ✓'); expect(text).toContain('brand=SoundBox Mini');
  });
  it('injects only the current stage and the unanswered questions into the prompt', () => {
    ledger.updateLedger({ stage: 'model' });
    const block = prompt.skillBlock();
    expect(block).toContain('营销视频大师'); expect(block).toContain('商品建模（当前）');
    expect(block).toContain('"key":"shape"'); expect(block).not.toContain('"key":"brand"');   // 已回答的品牌不再问，形状还要问
    expect(block).toContain('产品图契约');
    ledger.updateLedger({ stage: 'video' });
    expect(prompt.skillBlock()).not.toContain('"key":');   // 生成阶段没有问卷
  });
});
