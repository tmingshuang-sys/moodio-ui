// 转写稿：字幕解析、滚动字幕去重、分块、时间码
import { describe, expect, it } from 'vitest';
import { chunkTranscript, dedupeRolling, formatTimecode, mergeCues, parseCaptions, parseTimecode, transcriptMarkdown, youtubeId } from './transcript';

// YouTube 自动字幕的真实形状：每条都把上一条整行重复一遍，还带逐词时间戳
const ROLLING = `WEBVTT
Kind: captions
Language: en

00:00:04.160 --> 00:00:06.790 align:start position:0%
 
Welcome<00:00:04.520><c> to</c><00:00:04.640><c> CS229</c><00:00:05.320><c> machine</c><00:00:05.640><c> learning.</c>

00:00:06.790 --> 00:00:06.800 align:start position:0%
Welcome to CS229 machine learning.
 

00:00:06.800 --> 00:00:08.110 align:start position:0%
Welcome to CS229 machine learning.
Some<00:00:07.040><c> of</c><00:00:07.120><c> you</c><00:00:07.200><c> know</c><00:00:07.400><c> that</c>

00:00:08.120 --> 00:00:10.310 align:start position:0%
Some of you know that
this<00:00:08.280><c> is</c><00:00:08.400><c> a</c><00:00:08.520><c> class.</c>
`;

const SRT = `1
00:00:01,000 --> 00:00:03,500
第一句话。

2
00:00:03,500 --> 00:00:06,000
第二句话。
`;

describe('转写稿', () => {
  it('时间码双向转换', () => {
    expect(parseTimecode('00:01:02.500')).toBe(62.5);
    expect(parseTimecode('1:02')).toBe(62);
    expect(parseTimecode('00:00:03,140')).toBeCloseTo(3.14, 2);
    expect(Number.isNaN(parseTimecode('不是时间'))).toBe(true);
    expect(formatTimecode(62)).toBe('1:02');
    expect(formatTimecode(3725, true)).toBe('1:02:05');
  });

  it('自动字幕去掉滚动重复，只留新增的话', () => {
    const cues = parseCaptions(ROLLING);
    const text = cues.map(c => c.text).join(' | ');
    expect(text).toBe('Welcome to CS229 machine learning. | Some of you know that | this is a class.');
    expect(cues[0].start).toBeCloseTo(4.16, 2);
  });

  it('SRT 照常解析，标点结尾不会被并成一段', () => {
    const cues = parseCaptions(SRT);
    expect(cues.map(c => c.text)).toEqual(['第一句话。', '第二句话。']);
    expect(mergeCues(cues)).toHaveLength(2);
  });

  it('纯文本没有时间码时按段落切，时间按阅读速度估', () => {
    const cues = parseCaptions('第一段讲了一件事。\n\n第二段讲了另一件事。');
    expect(cues).toHaveLength(2);
    expect(cues[1].start).toBeGreaterThan(0);
  });

  it('同一句被切碎时合并回一段，间隔太久不合并', () => {
    const merged = mergeCues([
      { start: 0, end: 2, text: 'so what I want' },
      { start: 2, end: 4, text: 'to do today' },
      { start: 60, end: 62, text: '隔了很久的另一段' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].text).toBe('so what I want to do today');
  });

  it('空输入与全是表头的文件返回空，不抛', () => {
    expect(parseCaptions('')).toEqual([]);
    expect(parseCaptions('WEBVTT\nKind: captions\n')).toEqual([]);
    expect(dedupeRolling([])).toEqual([]);
  });

  it('转写稿按 3 分钟分小节，带来源与时间码', () => {
    const cues = Array.from({ length: 10 }, (_, i) => ({ start: i * 60, end: i * 60 + 50, text: `第 ${i} 段话。` }));
    const md = transcriptMarkdown(cues, { title: 'CS229', url: 'https://youtu.be/x', lang: 'en', auto: true });
    expect(md).toMatch('# 转写稿：CS229');
    expect(md).toMatch('自动字幕');
    expect((md.match(/^## \[/gm) || []).length).toBe(4);     // 0 / 3 / 6 / 9 分钟各起一节
    expect(md).toMatch('[1:00] 第 1 段话。');
  });

  it('分块按小节边界切，不会切出空块', () => {
    const cues = Array.from({ length: 200 }, (_, i) => ({ start: i * 20, end: i * 20 + 18, text: `这是第 ${i} 段话，内容足够长用来测试分块逻辑是否按小节边界切开。` }));
    const chunks = chunkTranscript(transcriptMarkdown(cues, { title: 'x' }), 3000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.trim() && c.length <= 3200)).toBe(true);
  });

  it('从各种 YouTube 链接里取 videoId', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=jGwO_UgTS7I&t=10')).toBe('jGwO_UgTS7I');
    expect(youtubeId('https://youtu.be/jGwO_UgTS7I')).toBe('jGwO_UgTS7I');
    expect(youtubeId('https://www.youtube.com/shorts/jGwO_UgTS7I')).toBe('jGwO_UgTS7I');
    expect(youtubeId('jGwO_UgTS7I')).toBe('jGwO_UgTS7I');
    expect(youtubeId('https://example.com/video')).toBeNull();
  });
});
