// 素材库：跨项目列出媒体，对非当前项目的改名 / 删除 / 撤销直接落到它的存储键
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let lib: typeof import('./library');
let session: typeof import('./session');
let store: typeof import('./store');
let projects: typeof import('./projects')['projects'];

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  lib = await import('./library'); session = await import('./session'); store = await import('./store');
  projects = (await import('./projects')).projects;
});
const media = (id: string, name: string, by: 'agent' | 'user' = 'agent') => ({ id, name, kind: 'image' as const, mime: 'image/png', size: 10, group: '其他', createdAt: Date.now(), by });

describe('library across creations', () => {
  it('lists media from the active project (live) and every other project (storage) with the creation title', () => {
    const first = projects.active();
    store.useFiles.getState().addMedia(media('m1', 'lantern.png'));
    session.startCreation();
    store.useChats.getState().push(store.useChats.getState().chat().id, { role: 'user', text: '第二次创作', at: Date.now() });
    store.useFiles.getState().addMedia(media('m2', 'cat.png', 'user'));
    const all = lib.allMedia();
    expect(all.map(m => [m.id, m.projectTitle])).toEqual([['m2', '第二次创作'], ['m1', first.title]]);
  });
  it('renames, deletes into that project\'s trash and restores media of a non-active project', () => {
    const first = projects.list()[0];
    lib.renameLibraryMedia(first.id, 'm1', 'red-lantern.png');
    expect(lib.allMedia().find(m => m.id === 'm1')!.name).toBe('red-lantern.png');
    const entry = lib.deleteLibraryMedia(first.id, 'm1')!;
    expect(entry.media!.id).toBe('m1');
    expect(lib.allMedia().some(m => m.id === 'm1')).toBe(false);
    expect(JSON.parse(memory.get('moodio-files-v1::' + first.id)!).trash[0].trashId).toBe(entry.trashId);
    lib.restoreLibraryMedia(first.id, entry.trashId);
    expect(lib.allMedia().find(m => m.id === 'm1')!.name).toBe('red-lantern.png');
    // 当前项目走内存仓库
    expect(lib.deleteLibraryMedia(projects.active().id, 'm2')!.media!.id).toBe('m2');
    expect(store.useFiles.getState().media.length).toBe(0);
  });
  it('opens a media item in its own creation by switching projects', () => {
    const first = projects.list()[0];
    expect(lib.openInCreation(first.id, 'm1')).toBe(true);
    expect(projects.active().id).toBe(first.id);
    expect(store.useFiles.getState().ui.openId).toBe('m1');
    expect(store.useFiles.getState().ui.paneOpen).toBe(true);
    expect(store.useNav.getState().page).toBe('chat');
  });
});
