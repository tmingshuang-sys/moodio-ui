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
    expect(planner.normalizeQuestions([{ text: '类型？', options: ['广告', '短片', ''], multi: 'yes' }, { text: '' }])).toEqual([{ text: '类型？', type: 'multi', options: [{ label: '广告', hint: undefined }, { label: '短片', hint: undefined }], multi: true, placeholder: undefined, key: undefined }]);
    // v2：选项可带说明，没有选项的题变成填空题，一批最多 8 题
    const v2 = planner.normalizeQuestions([{ key: 'size', text: '多大？', type: 'single', options: [{ label: '手掌大小', hint: '单手握住' }, '桌面级'] }, { key: 'brand', text: '品牌？', placeholder: '比如：SoundBox' }, ...Array.from({ length: 9 }, (_, i) => ({ text: 'q' + i, options: ['a'] }))]);
    expect(v2.length).toBe(8);
    expect(v2[0]).toEqual({ key: 'size', text: '多大？', type: 'single', options: [{ label: '手掌大小', hint: '单手握住' }, { label: '桌面级', hint: undefined }], multi: false, placeholder: undefined });
    expect(v2[1]).toEqual({ key: 'brand', text: '品牌？', type: 'text', options: [], multi: false, placeholder: '比如：SoundBox' });
  });
  it('rejects unknown tools and malformed shapes', () => {
    for (const bad of ['null', '{}', '[]', '{"message":"x","actions":[null]}', '{"message":"x","actions":[{"tool":"__proto__","args":{}}]}', '{"message":"x","actions":[{"tool":"format_disk","args":{}}]}']) {
      expect(() => planner.parseAgentPlan(bad)).toThrow();
    }
  });
});

describe('chat store', () => {
  it('mutate gives the changed chat a new identity so subscribers re-render, while message objects stay the same', () => {
    const chats = store.useChats.getState();
    const before = chats.chat();
    const msg = { role: 'assistant' as const, text: 'x', at: 1, plan: { key: 'k', steps: [], state: 'pending' as const } };
    chats.mutate(all => { all.find(c => c.id === before.id)!.messages.push(msg); });
    const after = store.useChats.getState().chat();
    expect(after).not.toBe(before);                       // 对话对象换了引用
    expect(after.messages.at(-1)).toBe(msg);              // 消息对象没换，执行器持有的引用仍然有效
    chats.mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === 1 && m.plan?.key === 'k') m.plan.state = 'cancelled'; });
    expect(store.useChats.getState().chat()).not.toBe(after);
    expect(store.useChats.getState().chat().messages.at(-1)!.plan!.state).toBe('cancelled');
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
    expect(tools.NO_CONFIRM_TOOLS.has('update_ledger')).toBe(true);
    expect(tools.GENERATE_TOOLS.has('compose_video')).toBe(true);
    expect(tools.describeAction({ tool: 'compose_video', args: { name: '成片', clip_ids: ['a', 'b', 'c'] } })).toContain('3 段视频');
    expect(tools.NO_CONFIRM_TOOLS.has('write_doc')).toBe(false);
  });
  it('write_doc creates a document through the typing hook, append and replace edit it', async () => {
    const typed: string[] = [];
    const ctx = { request: 'x', chatId: 'c', live: () => {}, typeInto: async (id: string, _from: string, to: string) => { typed.push(to); store.useFiles.getState().updateDoc(id, { content: to }); }, step: async (_l: string, fn?: () => any) => { await fn?.(); } };
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
