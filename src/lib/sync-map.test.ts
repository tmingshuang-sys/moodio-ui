// 同步的纯函数层：字段映射、挑要推的、合拉回来的。
// 这一层错了不会报错，只会悄悄丢数据或把新的盖成旧的，所以每条规则都单独守一个用例。
import { describe, expect, it } from 'vitest';
import type { Chat, Doc, MediaItem, TrashEntry } from './types';
import { chatRow, docRow, localChanges, mediaRow, planMerge, rowChat, rowDoc, rowMedia } from './sync-map';

const T0 = Date.parse('2026-10-31T00:00:00.000Z');
const doc = (over: Partial<Doc> = {}): Doc => ({ id: 'd1', name: '脚本.md', kind: 'md', content: '正文', createdAt: T0, updatedAt: T0, by: 'agent', chatId: 'c1', ...over });
const media = (over: Partial<MediaItem> = {}): MediaItem => ({ id: 'm1', name: '人物.png', kind: 'image', mime: 'image/png', size: 123, group: '人物', createdAt: T0, by: 'agent', ...over });
const chat = (over: Partial<Chat> = {}): Chat => ({ id: 'c1', title: '新对话', messages: [{ role: 'user', text: '你好', at: T0 }], at: T0, ...over });
const side = (over: Partial<{ docs: Doc[]; media: MediaItem[]; trash: TrashEntry[]; chats: Chat[] }> = {}) =>
  ({ docs: [], media: [], trash: [], chats: [], ...over });

describe('字段映射', () => {
  it('文稿来回一趟不丢字段', () => {
    const d = doc();
    expect(rowDoc(docRow(d))).toEqual(d);
  });

  it('媒体来回一趟不丢字段，group ↔ grp、voiceId ↔ voice_id 都换过来', () => {
    const m = media({ updatedAt: T0 + 5, width: 1024, height: 768, model: 'Seedream 5.0', duration: 3.5, voiceId: 'v-1', compose: { clips: ['m2'] } });
    const row = mediaRow(m);
    expect(row.grp).toBe('人物');
    expect(row.voice_id).toBe('v-1');
    expect(rowMedia(row)).toEqual(m);
  });

  it('老媒体没有 updatedAt 时按 createdAt 算，不会变成 1970 年而被远端整片盖掉', () => {
    expect(Date.parse(mediaRow(media()).updated_at)).toBe(T0);
  });

  it('对话来回一趟保留消息；没有标题的给默认名', () => {
    const c = chat();
    expect(rowChat(chatRow(c))).toEqual(c);
    expect(rowChat({ id: 'c9', messages: [], updated_at: new Date(T0).toISOString() }).title).toBe('新对话');
  });
});

describe('挑出要推的', () => {
  it('只推比游标新的', () => {
    const s = side({ docs: [doc({ id: 'old', updatedAt: T0 - 1000 }), doc({ id: 'new', updatedAt: T0 + 1000 })] });
    const out = localChanges(s, new Date(T0).toISOString());
    expect(out.docs.map(d => d.id)).toEqual(['new']);
  });

  it('这一轮刚从服务端合进来的不再推回去', () => {
    const s = side({ docs: [doc({ id: 'fromServer', updatedAt: T0 + 1000 })] });
    expect(localChanges(s, '', new Set(['fromServer'])).docs).toHaveLength(0);
  });

  it('回收站里的进同一张表并带上 deleted_at——否则服务端分不出「没推上来」和「删掉了」', () => {
    const s = side({ trash: [{ trashId: 't1', deletedAt: T0 + 2000, doc: doc({ id: 'gone' }) }] });
    const out = localChanges(s, new Date(T0).toISOString());
    expect(out.docs).toHaveLength(1);
    expect(out.docs[0].id).toBe('gone');
    expect(Date.parse(out.docs[0].deleted_at!)).toBe(T0 + 2000);
    // 删除时间同时写进 updated_at，这样它在服务端那条 last-write-wins 的比较里能赢过旧版本
    expect(Date.parse(out.docs[0].updated_at)).toBe(T0 + 2000);
  });

  it('空对话不推——新建创作时那条占位的「新对话」不该在服务端占一行', () => {
    const s = side({ chats: [chat({ id: 'empty', messages: [], at: T0 + 1000 })] });
    expect(localChanges(s, '').chats).toHaveLength(0);
  });
});

describe('合并拉回来的', () => {
  const remoteDoc = (over: any = {}) => ({ id: 'd1', name: '脚本.md', kind: 'md', content: '远端的', by: 'agent', chat_id: null, created_at: new Date(T0).toISOString(), updated_at: new Date(T0 + 1000).toISOString(), deleted_at: null, ...over });

  it('远端更新就覆盖', () => {
    const plan = planMerge(side({ docs: [doc()] }), { docs: [remoteDoc()] });
    expect(plan.docs[0].content).toBe('远端的');
    expect(plan.ids.has('d1')).toBe(true);
  });

  it('本地更新就不动它，留给下一步推上去', () => {
    const plan = planMerge(side({ docs: [doc({ updatedAt: T0 + 9000 })] }), { docs: [remoteDoc()] });
    expect(plan.docs).toHaveLength(0);
    expect(plan.ids.size).toBe(0);
  });

  it('时间一样不覆盖（同一条记录来回同步时不该反复写）', () => {
    const plan = planMerge(side({ docs: [doc({ updatedAt: T0 + 1000 })] }), { docs: [remoteDoc()] });
    expect(plan.docs).toHaveLength(0);
  });

  it('本地没有的直接收下', () => {
    const plan = planMerge(side(), { docs: [remoteDoc({ id: 'brandNew' })] });
    expect(plan.docs.map(d => d.id)).toEqual(['brandNew']);
  });

  it('远端标了删除就本地删掉；本地本来就没有的不记一笔', () => {
    const gone = remoteDoc({ deleted_at: new Date(T0 + 1000).toISOString() });
    expect(planMerge(side({ docs: [doc()] }), { docs: [gone] }).removeDocs).toEqual(['d1']);
    expect(planMerge(side(), { docs: [gone] }).removeDocs).toEqual([]);
  });

  it('正在流式输出的对话不碰——远端不可能比本机这一秒更新，盖上去会打断正在写的消息', () => {
    const remote = { chats: [{ id: 'c1', title: '远端', messages: [], updated_at: new Date(T0 + 9999).toISOString() }] };
    expect(planMerge(side({ chats: [chat()] }), remote, new Set(['c1'])).chats).toHaveLength(0);
    expect(planMerge(side({ chats: [chat()] }), remote).chats).toHaveLength(1);
  });

  it('媒体按 updatedAt 比，老数据回落到 createdAt', () => {
    const remote = { media: [{ id: 'm1', name: '新名.png', kind: 'image', grp: '场景', by: 'agent', created_at: new Date(T0).toISOString(), updated_at: new Date(T0 + 1).toISOString() }] };
    expect(planMerge(side({ media: [media()] }), remote).media[0].group).toBe('场景');
    expect(planMerge(side({ media: [media({ updatedAt: T0 + 50 })] }), remote).media).toHaveLength(0);
  });
});
