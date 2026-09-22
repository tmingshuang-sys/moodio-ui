import { beforeEach, describe, expect, it } from 'vitest';
import { blocksToMarkdown, htmlToMarkdown, migrateLegacyWorkspace } from './migrate';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
});

describe('legacy migration', () => {
  it('converts script blocks into markdown scenes and dialogue', () => {
    const md = blocksToMarkdown([{ type: 'scene', text: 'INT. 车内 - 夜' }, { type: 'action', text: '雨水沿着玻璃流下。' }, { type: 'character', text: '小林' }, { type: 'paren', text: '低声' }, { type: 'dialogue', text: '我们到了。' }, { type: 'transition', text: '切至' }]);
    expect(md).toBe('## INT. 车内 - 夜\n\n雨水沿着玻璃流下。\n\n**小林**\n（低声）\n我们到了。\n\n*切至*\n');
  });
  it('turns cloud doc html into markdown', () => {
    expect(htmlToMarkdown('<h2>故事梗概</h2><p>第一段</p><ul><li>要点</li></ul>')).toBe('## 故事梗概\n第一段\n- 要点');
  });
  it('builds docs and media from an old workspace', () => {
    memory.set('moodio-ui-refined-storyboard-v1::p1', JSON.stringify({
      fileStores: { film: { script: [{ id: 's1', type: 'script', title: '剧本正文 · 第一稿', scriptBlocks: [{ type: 'scene', text: 'INT. 车内 - 夜' }, { type: 'action', text: '雨。' }] }], synopsis: [{ id: 'y1', type: 'synopsis', title: '故事梗概', docHtml: '<p>猫。</p>' }], cover: [{ id: 'c1', type: 'cover', editableText: { 'content:0': '猫', 'content:1': '编剧', 'content:2': '一句话' } }] } },
      shots: [{ id: 1, scene: '01', description: '车内全景', camera: { size: '全景', angle: '平视', movement: '固定' }, duration: 4 }],
      catalog: { character: [{ id: 'ch1', name: '梦雨', meta: '女 · 22 岁', description: '新人。', image: 'data:image/png;base64,iVBORw0KGgo=' }] },
      brief: { format: 'series' },
    }));
    const r = migrateLegacyWorkspace('p1')!;
    expect(r.docs.map(d => d.name)).toEqual(['剧本正文 · 第一稿.md', '故事梗概.md', '封面.md', '分镜表.md', '人物小传.md']);
    expect(r.docs[0].content).toContain('## INT. 车内 - 夜');
    expect(r.docs[3].content).toContain('| 01 | 01 | 全景 | 平视 | 固定 | 4 | 车内全景 |');
    expect(r.docs[4].content).toContain('## 梦雨');
    expect(r.media).toHaveLength(1);
    expect(r.media[0].meta.name).toBe('梦雨.png');
    expect(r.media[0].meta.group).toBe('人物');
    expect(r.brief).toEqual({ format: 'series' });
  });
  it('returns null when there is nothing to migrate', () => {
    expect(migrateLegacyWorkspace('nope')).toBeNull();
  });
});
