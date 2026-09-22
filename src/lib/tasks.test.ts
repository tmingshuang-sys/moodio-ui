// 后台任务：落盘、页面重开时收拾「执行中」的计划卡、完成后补回步骤与产物
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let tasks: typeof import('./tasks');
let store: typeof import('./store');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  tasks = await import('./tasks'); store = await import('./store');
});
const step = (title: string, status: any) => ({ tool: 'generate_video', kind: 'video', title, preview: '', destructive: false, status, result: '', logs: [] });

describe('background tasks', () => {
  it('persists running tasks per project and reloads them', () => {
    tasks.useTasks.getState().add({ id: 't1', kind: 'video', provider: 'fal', name: '片段1', group: '其他', prompt: 'p', model: '可灵 1.0', createdAt: Date.now(), statusUrl: 'https://gw/fal/x/status', responseUrl: 'https://gw/fal/x', state: 'running', chatId: 'c1', messageAt: 100, stepIndex: 1 });
    expect(tasks.runningTasks().map(t => t.id)).toEqual(['t1']);
    tasks.useTasks.getState().reload();
    expect(tasks.runningTasks().map(t => t.id)).toEqual(['t1']);   // 落盘后重载还在
  });
  it('recovers plans on reload: steps backed by a live task stay running, interrupted ones fail, pending ones skip', () => {
    const chat = store.useChats.getState().chat();
    store.useChats.getState().mutate(all => { all.find(c => c.id === chat.id)!.messages.push({ role: 'assistant', text: '', at: 100, plan: { state: 'running', steps: [step('a', 'done'), step('b', 'running'), step('c', 'running'), step('d', 'pending')] } }); });
    // 任务 t1 指向 chatId c1，不是这条消息 → 视为无人接管；再加一条指向本消息第 2 步的任务
    tasks.useTasks.getState().add({ id: 't2', kind: 'video', provider: 'ark', name: '片段3', group: '其他', prompt: 'p', model: 'Seedance', createdAt: Date.now(), arkTaskId: 'ark-1', state: 'running', chatId: chat.id, messageAt: 100, stepIndex: 2 });
    tasks.recoverPlans();
    const m = store.useChats.getState().chat().messages.find(x => x.at === 100)!;
    expect(m.plan!.steps.map(s => s.status)).toEqual(['done', 'failed', 'running', 'skipped']);
    expect(m.plan!.steps[1].result).toBe('页面关闭时中断');
    expect(m.plan!.state).toBe('running');   // 还有后台任务在跑，卡片保持执行中
    tasks.patchStep({ chatId: chat.id, messageAt: 100, stepIndex: 2 }, 'done', '后台完成', { id: 'v9', kind: 'video', name: '片段3.mp4' });
    const after = store.useChats.getState().chat().messages.find(x => x.at === 100)!;
    expect(after.plan!.steps[2].status).toBe('done'); expect(after.artifacts!.map(a => a.id)).toEqual(['v9']);
    expect(after.plan!.state).toBe('error');   // 第 2 步中断过，所以整卡是出错而不是完成
  });
});
