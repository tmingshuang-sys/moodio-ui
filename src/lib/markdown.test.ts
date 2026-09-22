import { describe, expect, it } from 'vitest';
import { sections, findSection, replaceSection, appendMarkdown, plainText, uniqueName, ensureExt, docRole, wordCount } from './markdown';

const md = `# 剧本\n\n## INT. 车内 - 夜\n\n雨打在玻璃上。\n\n**梦雨**\n我们到了。\n\n## EXT. 门口 - 夜\n\n梦雨走进门厅。\n`;

describe('markdown sections', () => {
  it('splits by headings with nested levels', () => {
    const s = sections(md);
    expect(s.map(x => x.heading)).toEqual(['剧本', 'INT. 车内 - 夜', 'EXT. 门口 - 夜']);
    expect(s[0].end).toBe(md.split('\n').length);
    expect(s[1].end).toBe(s[2].start);
  });
  it('finds a section loosely and replaces it whole', () => {
    const s = findSection(md, '车内')!;
    expect(s.heading).toBe('INT. 车内 - 夜');
    const out = replaceSection(md, s, '## INT. 车内 - 夜\n\n新的一场。\n');
    expect(out).toContain('新的一场。');
    expect(out).not.toContain('我们到了');
    expect(out).toContain('## EXT. 门口 - 夜');
    const kept = replaceSection(md, s, '没有标题的正文');
    expect(kept).toContain('## INT. 车内 - 夜\n没有标题的正文');
  });
  it('appends with a blank line and strips syntax for previews', () => {
    expect(appendMarkdown('a\n', '## b')).toBe('a\n\n## b\n');
    expect(plainText('## 标题\n\n**梦雨**\n- 列表\n| a | b |\n|---|---|')).toBe('标题\n\n梦雨\n列表\na b');
    expect(wordCount('# 标 题\n\n正文 abc')).toBe(7);
  });
  it('keeps names unique and typed', () => {
    expect(uniqueName(['a.md', 'a-2.md'], 'a.md')).toBe('a-3.md');
    expect(ensureExt('剧本', 'md')).toBe('剧本.md');
    expect(ensureExt('data.json')).toBe('data.json');
    expect(docRole('视频生成Prompt-01.md')).toBe('prompt');
    expect(docRole('分镜表.md')).toBe('storyboard');
    expect(docRole('故事脚本.md')).toBe('script');
  });
});
