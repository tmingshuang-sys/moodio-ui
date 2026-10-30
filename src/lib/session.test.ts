// 创作会话：「创作」新建空白项目并热切换、创作历史跨项目、删除创作；不访问 DOM，用内存 localStorage
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let session: typeof import('./session');
let store: typeof import('../lib/store');
let projects: typeof import('./projects')['projects'];

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  session = await import('./session');
  store = await import('../lib/store');
  projects = (await import('./projects')).projects;
});
const user = (text: string) => ({ role: 'user' as const, text, at: Date.now() });

describe('creation session', () => {
  it('starts a blank creation without reloading, keeps the old one in history, and names the project after the first message', () => {
    const first = projects.active();
    expect(store.useFiles.getState().docs.length).toBeGreaterThan(0);                 // 第一个项目带示例文稿
    store.useChats.getState().push(store.useChats.getState().chat().id, user('写一条 30 秒的广告脚本'));
    expect(projects.active().title).toBe(first.title);                                  // 老项目不会被自动改名

    const p = session.startCreation()!;
    expect(p.id).not.toBe(first.id); expect(projects.active().id).toBe(p.id); expect(p.title).toBe('新创作');
    expect(store.useFiles.getState().docs).toEqual([]); expect(store.useFiles.getState().media).toEqual([]);
    expect(store.useFiles.getState().ui.paneOpen).toBe(false);                          // 新创作工作区默认收起
    expect(store.useChats.getState().chat().messages).toEqual([]);
    expect(session.isBlankCreation()).toBe(true);
    expect(session.startCreation()!.id).toBe(p.id);                                     // 已经是空白创作：复用，不再建一个
    expect(projects.list().length).toBe(2);

    const history = session.otherProjectsHistory();
    expect(history).toEqual([expect.objectContaining({ projectId: first.id, title: '写一条 30 秒的广告脚本' })]);

    store.useChats.getState().push(store.useChats.getState().chat().id, user('帮我写一个 3 分钟短片'));
    expect(projects.active().title).toBe('帮我写一个 3 分钟短片');                        // 项目名跟着第一句话走
    expect(document.title).toBe('帮我写一个 3 分钟短片 · WoW');
  });
  it('switches back to an earlier creation with its files and chat intact, and reuses a blank creation instead of adding another', () => {
    const [first, second] = projects.list();
    expect(session.switchProject(first.id, session.otherProjectsHistory()[0].chatId)).toBe(true);
    expect(projects.active().id).toBe(first.id);
    const blank = session.startCreation()!;                                              // 另建一个空白创作
    expect(blank.id).not.toBe(first.id); expect(blank.id).not.toBe(second.id); expect(projects.list().length).toBe(3);
    session.switchProject(first.id);
    expect(session.startCreation()!.id).toBe(blank.id);                                  // 再点「创作」：切回那个空白的，不再新建
    expect(projects.list().length).toBe(3); expect(projects.active().id).toBe(blank.id);
    expect(session.deleteCreation(blank.id)).toBe(true);                                 // 删掉它，回到最近改动的项目
    expect(projects.list().length).toBe(2); expect(projects.active().id).not.toBe(blank.id);
    session.switchProject(first.id);
    expect(store.useFiles.getState().docs.length).toBeGreaterThan(0);
    expect(store.useChats.getState().chat().messages[0].text).toBe('写一条 30 秒的广告脚本');
    expect(session.otherProjectsHistory()).toEqual([expect.objectContaining({ projectId: second.id, title: '帮我写一个 3 分钟短片' })]);
    expect(session.chatCount(second.id)).toBe(1);
  });
  it('renames and deletes creations from history, and clears the last remaining one instead of refusing', () => {
    const [first, second] = projects.list();
    session.renameHistoryChat(second.id, session.otherProjectsHistory()[0].chatId, '短片脚本');
    expect(session.otherProjectsHistory()[0].title).toBe('短片脚本');
    expect(projects.list().find(p => p.id === second.id)!.title).toBe('短片脚本');       // 项目名同步
    expect(session.deleteCreation(second.id)).toBe(true);
    expect(projects.list().map(p => p.id)).toEqual([first.id]);
    expect(memory.has('moodio-files-v1::' + second.id)).toBe(false);                    // 文件与对话一起清掉
    expect(session.deleteCreation(first.id)).toBe(true);                                // 只剩一个：清空成新创作
    expect(projects.list().length).toBe(1); expect(projects.active().title).toBe('新创作');
    expect(store.useFiles.getState().docs).toEqual([]); expect(store.useChats.getState().chat().messages).toEqual([]);
    expect(store.useFiles.getState().ui.paneOpen).toBe(false);
  });
  it('refuses to switch while the agent is busy', () => {
    store.useAgent.getState().set({ busy: true });
    expect(session.startCreation()).toBeNull();
    store.useAgent.getState().set({ busy: false });
  });
});
