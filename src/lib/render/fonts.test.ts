import { describe, it, expect } from 'vitest';
import { __test, RENDER_FONT, fontReady, loadRenderFont } from './fonts';

// 字体是「预览所见 = 成片所得」的根基。文件实物（在不在、有多大）由 scripts/postbuild.mjs 在构建时查，
// 这里守代码这头：名字、字重、路径选择，以及没有 document 时不许抛错
describe('渲染字体', () => {
  it('两个字重，文件按字重命名', () => {
    expect(RENDER_FONT).toBe('WoW Sans');
    expect(__test.FILES.map(f => f.weight)).toEqual([400, 700]);
    for (const f of __test.FILES) expect(f.file).toBe(`wow-sans-${f.weight}.woff2`);
  });

  it('不在 /wow/ 下时字体在站点根的 /fonts/', () => {
    expect(__test.fontBase()).toBe('/fonts/');
  });

  it('没有 document（node 里）时不抛错，只说字体没就绪', async () => {
    expect(fontReady()).toBe(false);
    expect(await loadRenderFont()).toBe(false);
  });
});
