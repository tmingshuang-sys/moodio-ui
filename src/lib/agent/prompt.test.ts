// 系统提示按创作类型分流：科普流水线不该看到影视那一套工具、文稿约定与契约
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let prompt: typeof import('./prompt'); let store: typeof import('../store'); let ledger: typeof import('../ledger');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  memory.set('moodio-project-fresh::x', '1');
  prompt = await import('./prompt'); store = await import('../store'); ledger = await import('../ledger');
  store.useFiles.getState().docs.forEach(d => store.useFiles.getState().removeDoc(d.id));
});
const chat = { id: 'c', title: '', messages: [], createdAt: 0, updatedAt: 0 } as any;
const build = (stage: string) => { ledger.updateLedger({ stage: stage as any }); return prompt.buildSystemPrompt('继续', chat); };

describe('系统提示 · 科普', () => {
  beforeAll(() => {
    store.useFiles.getState().setBrief({ format: 'explainer', duration: '60 秒', ratio: '竖屏 9:16', audience: '完全零基础' });
    ledger.ensureLedger('explainer');
  });

  it('给的是科普的工具，不给视频模型那一套', () => {
    const p = build('scene');
    for (const t of ['import_transcript', 'extract_points', 'lint_narration', 'lint_scene', 'narrate_scene', 'render_scene']) expect(p).toContain(t);
    for (const t of ['generate_video', 'make_sheet', 'lint_clips', 'inspect_image', 'generate_voice']) expect(p).not.toContain(t);
  });

  it('不出现剧本格式、分镜表、片段提示词、段落衔接这些影视约定', () => {
    const p = build('scene');
    for (const w of ['INT./EXT', '场景标题', '视频生成Prompt', '片段提示词', '段落衔接', '证据来源契约', '卖点账本', '七视图']) expect(p).not.toContain(w);
  });

  it('纲领不要求调性（科普没这道题），也不提示缺它', () => {
    expect(prompt.briefMissing()).toEqual([]);
    expect(build('scene')).not.toContain('尚缺');
  });

  it('每个阶段只注入这一阶段要用的规范', () => {
    expect(build('knowledge')).toContain('知识点清单格式');
    expect(build('knowledge')).not.toContain('画面模板与各自要的字段');
    expect(build('script')).toContain('口播文案规范');
    expect(build('script')).not.toContain('画面模板与各自要的字段');
    const scene = build('scene');
    expect(scene).toContain('画面模板与各自要的字段');
    expect(scene).toContain('不要自己写 seconds');
    expect(build('render')).toContain('不要用 generate_video');
  });

  it('阶段链是科普自己的九步', () => {
    expect(build('scene')).toContain('brief → source → knowledge → script → scene → narrate → render → compose → deliver');
  });

  it('提示词长度仍在可控范围（太长模型写 JSON 就容易走形）', () => {
    expect(build('scene').length).toBeLessThan(14000);
  });
});

describe('系统提示 · 影视（没有被科普改坏）', () => {
  it('广告仍拿到视频模型那一套与段落衔接契约', () => {
    store.useFiles.getState().setBrief({ format: 'ad', duration: '60 秒', ratio: '竖屏 9:16', audience: '学生', tone: '剧情故事型' });
    ledger.updateLedger({ skill: 'ad', stage: 'prompts' });
    const p = prompt.buildSystemPrompt('写片段提示词', chat);
    expect(p).toContain('generate_video');
    expect(p).toContain('段落衔接契约');
    expect(p).toContain('当前视频模型');
    expect(p).not.toContain('render_scene');
  });
});
