// Agent 规划与工具层的回归测试：不访问真实模型，用内存 localStorage 与最小 DOM 桩
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let planner: typeof import('./planner');
let tools: typeof import('./tools');
let store: typeof import('../store');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).URL = Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} });
  (globalThis as any).location = { reload() {} };
  memory.set('moodio-project-fresh::' + 'x', '1');
  planner = await import('./planner');
  tools = await import('./tools');
  store = await import('../store');
});

describe('plan parsing', () => {
  it('accepts a valid plan and normalises follow-ups and questions', () => {
    const r = planner.parseAgentPlan(JSON.stringify({ message: '好', actions: [{ tool: 'write_doc', args: { name: 'a.md', content: 'x' } }], followUps: [{ label: '继续', prompt: '继续写' }, { label: '继续', prompt: '重复标签' }, { label: 'x'.repeat(30), prompt: '太长' }] }));
    expect(r.actions).toEqual([{ tool: 'write_doc', args: { name: 'a.md', content: 'x' } }]);
    expect(r.followUps).toEqual([{ label: '继续', prompt: '继续写' }]);
    expect(planner.normalizeQuestions([{ text: '类型？', options: ['广告', '短片', ''], multi: 'yes' }, { text: '' }])).toEqual([{ text: '类型？', options: ['广告', '短片'], multi: true }]);
  });
  it('rejects unknown tools and malformed shapes', () => {
    for (const bad of ['null', '{}', '[]', '{"message":"x","actions":[null]}', '{"message":"x","actions":[{"tool":"__proto__","args":{}}]}', '{"message":"x","actions":[{"tool":"format_disk","args":{}}]}']) {
      expect(() => planner.parseAgentPlan(bad)).toThrow();
    }
  });
});

describe('plan steps and tools', () => {
  it('describes steps with previews and destructive marks', () => {
    const steps = tools.planSteps([{ tool: 'write_doc', args: { name: '故事脚本', content: '# 剧本\n\n## INT. 车内 - 夜\n\n雨。' } }, { tool: 'delete_doc', args: { id: 'nope' } }]);
    expect(steps[0].title).toBe('新建文稿「故事脚本.md」（约 12 字）');
    expect(steps[0].preview).toContain('## INT. 车内 - 夜');
    expect(steps[0].kind).toBe('write');
    expect(steps[1].destructive).toBe(true);
    expect(tools.NO_CONFIRM_TOOLS.has('read_doc')).toBe(true);
    expect(tools.NO_CONFIRM_TOOLS.has('write_doc')).toBe(false);
  });
  it('write_doc creates a document through the typing hook, append and replace edit it', async () => {
    const typed: string[] = [];
    const ctx = { request: 'x', chatId: 'c', typeInto: async (id: string, _from: string, to: string) => { typed.push(to); store.useFiles.getState().updateDoc(id, { content: to }); }, step: async (_l: string, fn?: () => any) => { await fn?.(); } };
    const r1 = await tools.AGENT_TOOLS.write_doc({ name: '测试剧本.md', content: '# 剧本\n\n## INT. 车内 - 夜\n\n雨。' }, ctx) as any;
    const doc = store.useFiles.getState().docs.find(d => d.name === '测试剧本.md')!;
    expect(doc.content).toContain('## INT. 车内 - 夜');
    expect(r1.review).toEqual({ docId: doc.id, title: '测试剧本.md' });
    const r2 = await tools.AGENT_TOOLS.write_doc({ name: '测试剧本.md', content: '新' }, ctx) as any;
    expect(r2.summary).toContain('测试剧本-2.md');
    await tools.AGENT_TOOLS.append_doc({ id: doc.id, content: '## EXT. 门口 - 夜\n\n风。' }, ctx);
    expect(store.useFiles.getState().docs.find(d => d.id === doc.id)!.content).toContain('## EXT. 门口 - 夜');
    await tools.AGENT_TOOLS.replace_section({ id: doc.id, heading: 'INT. 车内 - 夜', content: '## INT. 车内 - 夜\n\n雪。' }, ctx);
    const after = store.useFiles.getState().docs.find(d => d.id === doc.id)!.content;
    expect(after).toContain('雪。'); expect(after).not.toContain('雨。'); expect(after).toContain('风。');
    await expect(tools.AGENT_TOOLS.replace_section({ id: doc.id, heading: '不存在', content: 'x' }, ctx)).rejects.toThrow('找不到标题');
    const del = await tools.AGENT_TOOLS.delete_doc({ id: doc.id }, ctx) as any;
    expect(store.useFiles.getState().docs.some(d => d.id === doc.id)).toBe(false);
    expect(del.actions[0].id).toMatch(/^restore-trash:/);
    store.useFiles.getState().restoreTrash(del.actions[0].id.slice(14));
    expect(store.useFiles.getState().docs.some(d => d.name === '测试剧本.md')).toBe(true);
    expect(typed.length).toBe(4);
  });
});
