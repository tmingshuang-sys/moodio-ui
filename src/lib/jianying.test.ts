// 剪映草稿生成：时间线首尾相接、素材与附属材料引用一致、索引文件用相对路径；zip 结构合法
import { beforeAll, describe, expect, it } from 'vitest';

let buildDraftJson: typeof import('./jianying')['buildDraftJson']; let makeZip: typeof import('./jianying')['makeZip']; let crc32: typeof import('./jianying')['crc32']; let safeFolderName: typeof import('./jianying')['safeFolderName'];
beforeAll(async () => {
  const memory = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  (globalThis as any).indexedDB = undefined;
  ({ buildDraftJson, makeZip, crc32, safeFolderName } = await import('./jianying'));
});

describe('jianying draft', () => {
  it('builds a draft whose segments follow each other and reference their materials', () => {
    const d = buildDraftJson({ name: '测试', clips: [{ name: 'a.mp4', path: 'videos/clip_01.mp4', durationUs: 15_000_000, width: 1280, height: 720 }, { name: 'b.mp4', path: 'videos/clip_02.mp4', durationUs: 10_000_000, width: 1280, height: 720 }] }, 1_700_000_000_000);
    expect(d.info.duration).toBe(25_000_000); expect(d.info.canvas_config).toEqual({ background: null, height: 720, ratio: 'custom', width: 1280 });
    const segs = d.info.tracks[0].segments; expect(segs.map((s: any) => s.target_timerange.start)).toEqual([0, 15_000_000]);
    const ids = new Set(d.info.materials.videos.map((v: any) => v.id)); expect(segs.every((s: any) => ids.has(s.material_id))).toBe(true);
    for (const s of segs) for (const ref of s.extra_material_refs) expect(['speeds', 'canvases', 'sound_channel_mappings', 'vocal_separations'].some(g => d.info.materials[g].some((m: any) => m.id === ref))).toBe(true);
    expect(d.info.materials.videos[1].path).toBe('videos/clip_02.mp4'); expect(d.meta.draft_materials[0].value[1].file_Path).toBe('./videos/clip_02.mp4');
    expect(d.meta.draft_name).toBe('测试'); expect(d.meta.tm_duration).toBe(25_000_000); expect(d.meta.draft_id).toBe(d.info.id);
    expect(d.settings).toContain('draft_create_time=1700000000'); expect(JSON.parse(d.agency).video_resolution).toBe(720);
  });
  it('writes a valid store-only zip', () => {
    const data = new TextEncoder().encode('hello'); expect(crc32(data)).toBe(0x3610a686);
    const zip = makeZip([{ path: 'a/b.txt', data }, { path: 'a/dir/', data: new Uint8Array(0) }]);
    expect(zip.size).toBe(30 + 7 + 5 + 30 + 6 + 0 + 46 + 7 + 46 + 6 + 22);
    expect(safeFolderName('广告 · 实物产品 / 测试:1')).toBe('广告 · 实物产品 测试 1');
  });
});
