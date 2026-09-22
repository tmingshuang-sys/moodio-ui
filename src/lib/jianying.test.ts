// 导出到剪映：片段按顺序命名、清单可读；zip 结构合法
import { describe, expect, it } from 'vitest';
import { makeZip, crc32, safeFolderName } from './jianying-draft';
import { buildManifest, fileExt } from './jianying';

describe('导出片段到剪映', () => {
  it('清单按顺序列出片段与时长', () => {
    const text = buildManifest('末班车', [{ file: 'clip_01.mp4', name: '片段一.mp4', seconds: 15.1 }, { file: 'clip_02.mp4', name: '片段二.mp4', seconds: 10 }]);
    expect(text).toContain('末班车 · 片段清单');
    expect(text).toContain('01. clip_01.mp4  15.1 秒   ← 片段一.mp4');
    expect(text.indexOf('01. clip_01')).toBeLessThan(text.indexOf('02. clip_02'));
    expect(text).toContain('合计 2 段，约 25 秒');
  });
  it('扩展名优先用文件名，其次按 mime 推', () => {
    expect(fileExt({ name: '成片.webm', mime: 'video/mp4' })).toBe('webm');
    expect(fileExt({ name: '无扩展名', mime: 'video/quicktime' })).toBe('mov');
    expect(fileExt({ name: '无扩展名', mime: '' })).toBe('mp4');
  });
  it('打出合法的 store-only zip', () => {
    const data = new TextEncoder().encode('hello'); expect(crc32(data)).toBe(0x3610a686);
    const zip = makeZip([{ path: 'a/b.txt', data }, { path: 'a/dir/', data: new Uint8Array(0) }]);
    expect(zip.size).toBe(30 + 7 + 5 + 30 + 6 + 0 + 46 + 7 + 46 + 6 + 22);
    expect(safeFolderName('广告 · 实物产品 / 测试:1')).toBe('广告 · 实物产品 测试 1');
  });
});
