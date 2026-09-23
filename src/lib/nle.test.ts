// 导出到剪辑软件：FCPXML 片段首尾相接、媒体引用是绝对 file:// URL；EDL 时间码连续
import { describe, expect, it } from 'vitest';
import { buildFcpxml, buildEdl, buildSrt, fileUrl, cleanPath, isAbsolutePath, pathFromDrop } from './nle';

const clips = [{ file: 'clip_01.mp4', name: '片段01', seconds: 15.1, width: 1254, height: 720 }, { file: 'clip_02.mp4', name: '片段02', seconds: 10, width: 1254, height: 720 }];

describe('导出到剪辑软件', () => {
  it('FCPXML 的片段首尾相接，媒体用绝对 file:// URL', () => {
    const xml = buildFcpxml({ title: '末班车', clips, dirPath: '/Users/a/Movies/末班车 片段/' });
    expect(xml).toContain('<fcpxml version="1.9">');
    expect(xml).toContain('frameDuration="100/3000s" width="1254" height="720"');
    expect(xml).toContain('src="file:///Users/a/Movies/%E6%9C%AB%E7%8F%AD%E8%BD%A6%20%E7%89%87%E6%AE%B5/clip_01.mp4"');   // 中文与空格都编码
    const offsets = [...xml.matchAll(/asset-clip ref="a\d+" offset="(\S+?)"/g)].map(m => m[1]);
    expect(offsets).toEqual(['0/3000s', '45300/3000s']);   // 第二段从 15.1 秒（453 帧）开始
    expect(xml).toContain('duration="45300/3000s"'); expect(xml).toContain('duration="30000/3000s"');
    expect(xml).toContain('<sequence format="r0" duration="75300/3000s"');   // 合计 25.1 秒
    expect(xml.indexOf('name="片段01"')).toBeLessThan(xml.indexOf('name="片段02"'));
  });
  it('EDL 的时间码连续', () => {
    const edl = buildEdl({ title: '末班车', clips });
    expect(edl).toContain('TITLE: 末班车');
    expect(edl).toContain('00:00:00:00 00:00:15:03 00:00:00:00 00:00:15:03');   // 第一段 0 → 15.1 秒
    expect(edl).toContain('00:00:15:03 00:00:25:03');                            // 第二段接在后面
    expect(edl).toContain('* FROM CLIP NAME: clip_02.mp4');
  });
  it('路径规整与校验', () => {
    expect(cleanPath('  "/Users/a/Movies/"  ')).toBe('/Users/a/Movies');
    expect(isAbsolutePath('/Users/a')).toBe(true); expect(isAbsolutePath('Users/a')).toBe(false); expect(isAbsolutePath('~/Movies')).toBe(false);
    expect(fileUrl('/a b/c&d.mp4')).toBe('file:///a%20b/c%26d.mp4');
  });
});

describe('从访达拖进来的路径', () => {
  const dt = (data: Record<string, string>) => ({ getData: (t: string) => data[t] || '' } as unknown as DataTransfer);
  it('解析 uri-list 里的 file:// 并解码中文与空格', () => {
    expect(pathFromDrop(dt({ 'text/uri-list': 'file:///Users/andrew/Movies/%E7%89%87%E6%AE%B5%20%E5%A4%B9/' }))).toBe('/Users/andrew/Movies/片段 夹');
    expect(pathFromDrop(dt({ 'text/plain': '/Users/andrew/Movies/x' }))).toBe('/Users/andrew/Movies/x');
    expect(pathFromDrop(dt({ 'text/uri-list': 'https://example.com/a' }))).toBe('');
    expect(pathFromDrop(null)).toBe('');
  });
});

describe('字幕文件', () => {
  it('SRT 按时间排序、跳过空的', () => {
    const srt = buildSrt([{ start: 6, end: 9.5, text: '第二句' }, { start: 1, end: 4, text: ' 第一句 ' }, { start: 9, end: 9, text: '零长' }, { start: 2, end: 3, text: '' }]);
    expect(srt).toBe('1\n00:00:01,000 --> 00:00:04,000\n第一句\n\n2\n00:00:06,000 --> 00:00:09,500\n第二句\n');
  });
});
