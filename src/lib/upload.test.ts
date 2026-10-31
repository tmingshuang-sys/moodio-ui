// 拖进来的文件该进媒体库还是文稿区
import { beforeAll, describe, expect, it } from 'vitest';

let docKindOf: typeof import('./upload').docKindOf;
let docNameOf: typeof import('./upload').docNameOf;
let partitionFiles: typeof import('./upload').partitionFiles;
let TEXT_EXT: RegExp;

// upload.ts 要经过仓库与项目层，它们在模块加载时就会碰 localStorage 和 document
beforeAll(async () => {
  const memory = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  const m = await import('./upload');
  docKindOf = m.docKindOf; docNameOf = m.docNameOf; partitionFiles = m.partitionFiles; TEXT_EXT = m.TEXT_EXT;
});

const file = (name: string, type = '') => new File(['x'], name, { type });

describe('拖放文件的分流', () => {
  it('图片、视频、音频进媒体库', () => {
    const { media, text, rejected } = partitionFiles([file('产品.jpg', 'image/jpeg'), file('片段.mp4', 'video/mp4'), file('主题曲.mp3', 'audio/mpeg')]);
    expect(media.map(f => f.name)).toEqual(['产品.jpg', '片段.mp4', '主题曲.mp3']);
    expect(text).toHaveLength(0); expect(rejected).toHaveLength(0);
  });

  it('没有 MIME 的音频按扩展名也认', () => {
    expect(partitionFiles([file('bgm.flac')]).media).toHaveLength(1);
  });

  it('字幕与文字稿进文稿区（科普流水线的 import_transcript 要的就是这个）', () => {
    const { media, text } = partitionFiles([file('CS229.srt'), file('课程.vtt'), file('笔记.txt', 'text/plain'), file('台账.json', 'application/json'), file('大纲.md')]);
    expect(media).toHaveLength(0);
    expect(text.map(f => f.name)).toEqual(['CS229.srt', '课程.vtt', '笔记.txt', '台账.json', '大纲.md']);
  });

  it('其余的明确拒绝，不要悄悄吞掉', () => {
    const { rejected } = partitionFiles([file('合同.pdf', 'application/pdf'), file('工程.zip', 'application/zip')]);
    expect(rejected.map(f => f.name)).toEqual(['合同.pdf', '工程.zip']);
  });

  it('文稿类型按扩展名定，字幕当纯文本', () => {
    expect(docKindOf('台账.json')).toBe('json');
    expect(docKindOf('大纲.md')).toBe('md');
    expect(docKindOf('CS229.srt')).toBe('txt');
    expect(TEXT_EXT.test('a.SRT')).toBe(true);
  });

  it('字幕的扩展名换成 .txt，不是在后面再加一节', () => {
    expect(docNameOf('CS229.vtt')).toBe('CS229.txt');
    expect(docNameOf('课程.srt')).toBe('课程.txt');
    expect(docNameOf('数据.csv')).toBe('数据.txt');
    expect(docNameOf('大纲.markdown')).toBe('大纲.md');
    expect(docNameOf('笔记.txt')).toBe('笔记.txt');      // 本来就对就别动
    expect(docNameOf('台账.json')).toBe('台账.json');
  });

  it('空输入不炸', () => {
    expect(partitionFiles([])).toEqual({ media: [], text: [], rejected: [] });
    expect(partitionFiles(null as any).media).toEqual([]);
  });
});
