// 创作流程包与台账：按类型选技能、阶段骨架一致、问卷题库、台账合并与阶段推进、系统提示里的流程块
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let skills: typeof import('./skills');
let ledger: typeof import('./ledger');
let store: typeof import('./store');
let prompt: typeof import('./agent/prompt');
let lint: typeof import('./lint');
let guides: typeof import('./guides');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  skills = await import('./skills'); ledger = await import('./ledger'); store = await import('./store'); prompt = await import('./agent/prompt'); lint = await import('./lint'); guides = await import('./guides');
});

describe('skill packs', () => {
  it('has one pack per creative format with the same eight-stage skeleton', () => {
    for (const id of ['ad', 'film', 'series', 'short', 'mv', 'other']) {
      const s = skills.skillFor(id); expect(s.id).toBe(id);
      expect(skills.skillStages(s).map(x => x.id)).toEqual(skills.STAGE_ORDER);
      expect(s.general.length).toBeGreaterThanOrEqual(3); expect(s.modeling.length).toBeGreaterThanOrEqual(2);
      expect(s.contracts.length).toBeGreaterThanOrEqual(2); expect(s.modelDocs.length).toBeGreaterThanOrEqual(1);
      expect(s.modelTemplate, `${id} needs a frozen modeling template`).toBeTruthy(); expect(s.clipFocus).toBeTruthy();
      expect(s.contracts.some(c => c.startsWith('证据来源契约'))).toBe(true);   // 证据来源契约对所有类型生效
      for (const q of [...s.general, ...s.modeling]) { expect(q.key).toBeTruthy(); expect(q.text).toBeTruthy(); if (q.type !== 'text') expect(q.options.length).toBeGreaterThan(1); else expect(q.placeholder).toBeTruthy(); }
    }
    expect(skills.skillFor('nope').id).toBe('other');
    // 画风题在每个类型的通用问卷里，答案回写纲领 visualStyle；画风基线默认写实真人
    for (const id of ['ad', 'film', 'series', 'short', 'mv', 'other']) { const q = skills.skillFor(id).general.find(x => x.key === 'look'); expect(q && skills.briefKeyOf(q)).toBe('visualStyle'); expect(q!.recommended).toEqual([0]); }
    expect(guides.styleBaseline(undefined)).toContain('photorealistic');
    const en = guides.applyStyleBaseline('Character reference sheet of a 5-year-old boy, warm smile', undefined);
    expect(en.startsWith('Photorealistic RAW photograph')).toBe(true); expect(en).toContain('full-body photograph of a 5-year-old boy'); expect(en).not.toMatch(/reference sheet/i); expect(en).toContain('画风基线：');
    expect(guides.applyStyleBaseline('五岁男孩的角色设定图，站在客厅', '写实真人').startsWith('写实真人照片')).toBe(true);
    expect(guides.applyStyleBaseline('a boy', '3D 动画')).not.toMatch(/^Photorealistic/);
    // 人物类参考图套七视图设定图：只留人物描述，布局与避免项由模板补，末尾带画风基线
    const sheet = guides.characterSheetPrompt('五岁中国男孩，短黑发，浅蓝色 T 恤\n画风基线：旧的', undefined);
    expect(sheet).toContain('【人物】五岁中国男孩'); expect(sheet).not.toContain('旧的'); expect(sheet).toContain('七个视图'); expect(sheet).toContain('2×2'); expect(sheet.startsWith('写实真人摄影')).toBe(true); expect(sheet).toContain('画风基线：');
    expect(guides.characterSheetPrompt('x', '3D 动画').startsWith('七视图人物设定图')).toBe(true);
    expect(guides.isCharacterAsset('人物')).toBe(true); expect(guides.isCharacterAsset('产品', '清岚C1-正面')).toBe(false); expect(guides.isCharacterAsset('其他', '老周形象图')).toBe(true); expect(guides.applyStyleBaseline('已有\n画风基线：x', undefined)).toBe('已有\n画风基线：x'); expect(guides.styleBaseline('3D 动画')).toContain('3D animated'); expect(guides.styleBaseline('赛博朋克油画')).toContain('赛博朋克油画');
    expect(skills.skillFor('ad').name).toBe('营销视频大师'); expect(skills.skillFor('mv').modelDocs).toContain('歌曲分析.md');
    expect(skills.skillStages(skills.skillFor('ad'))[1].name).toBe('商品建模');
    expect(skills.skillStages(skills.skillFor('film'))[1].name).toBe('人物与世界建模');
    // 样例：广告与故事片各有建模 + 片段样例，样例本身要过我们自己的冻结格式（时段相接、参考音频、无 BGM 尾注）
    for (const id of ['ad', 'film', 'series', 'mv']) { const s = skills.skillFor(id); expect(s.samples?.model).toBeTruthy(); expect(s.samples?.clip).toMatch(/full-film range/); expect(s.samples?.clip).toMatch(/不生成(人声与)? ?BGM/); }
    // MV 样例：段落表能被解析成乐段、片段贴着段落边界、艺人冻结描述逐字复用、有正面咬字镜头
    const segs = lint.songSegments(skills.MV_MODEL_SAMPLE); expect(segs.map(x => [x.start, x.end])).toEqual([[0, 15], [15, 30], [30, 45], [45, 60]]);
    const mvFrozen = lint.frozenDescriptions(skills.MV_MODEL_SAMPLE); expect(mvFrozen.map(f => f.name)).toEqual(['艺人']);
    const mvLint = lint.lintClipDocs([{ name: '视频生成Prompt-03.md', content: skills.MV_CLIP_SAMPLE }], [], null, { frozen: mvFrozen, segments: segs, maxClip: 15 }); expect(mvLint.errors).toEqual([]);
    expect(skills.MV_CLIP_SAMPLE).toContain('精准咬字口型：{'); expect(skills.skillFor('mv').imageQA).toContain('七视图');
    expect(skills.skillFor('film').samples!.clip).toContain('音色参考@音频1');
    expect(lint.voiceDescriptions(skills.FILM_MODEL_SAMPLE).map(v => v.name)).toEqual(['老周', '女孩', '旁白']);
    expect(lint.voiceDescriptions('## 甲\n音色：无\n## 乙\n- 音色：清亮少年音')).toEqual([{ name: '乙', desc: '清亮少年音' }]);
    const frozen = lint.frozenDescriptions(skills.FILM_MODEL_SAMPLE); expect(frozen.map(f => f.name)).toEqual(['老周', '女孩']);
    const film = lint.lintClipDocs([{ name: '视频生成Prompt-02.md', content: skills.FILM_CLIP_SAMPLE }], [], null, { frozen }); expect(film.errors).toEqual([]);
    const ad = lint.lintClipDocs([{ name: '视频生成Prompt-02.md', content: skills.AD_CLIP_SAMPLE }], [], null); expect(ad.errors).toEqual([]);
    expect(skills.skillFor('film').contracts.some(c => c.startsWith('对白契约'))).toBe(true);
    // 段落衔接契约挂在所有类型上；三份片段样例都带衔接与结尾状态两行
    for (const id of ['ad', 'film', 'series', 'short', 'mv', 'other']) expect(skills.skillFor(id).contracts.some(c => c.startsWith('段落衔接契约'))).toBe(true);
    for (const id of ['ad', 'film', 'mv']) { const c = skills.skillFor(id).samples!.clip; expect(c).toMatch(/\n衔接[：:]/); expect(c).toMatch(/\n结尾状态[：:]/); }
    expect(skills.MV_CLIP_SAMPLE).not.toContain('承接：');
  });
});

describe('ledger', () => {
  it('is created once per creation, merges patches and advances stages in order', () => {
    expect(ledger.readLedger()).toBeNull();
    store.useFiles.getState().setBrief({ format: 'ad', duration: '60 秒' });
    const first = ledger.ensureLedger('ad'); expect(first.created).toBe(true); expect(first.ledger.skill).toBe('ad'); expect(first.ledger.stage).toBe('brief');
    expect(ledger.ensureLedger('ad').created).toBe(false);
    expect(store.useFiles.getState().docs.some(d => d.name === '台账.json')).toBe(true);
    let l = ledger.updateLedger({ answers: { brand: 'SoundBox Mini', size: '手掌大小' } });
    expect(l.answers).toEqual({ brand: 'SoundBox Mini', size: '手掌大小' });
    l = ledger.updateLedger({ stage: 'script', answers: { color: '哑光黑' } });
    expect(l.stage).toBe('script'); expect(l.done).toEqual(['brief', 'model']); expect(Object.keys(l.answers)).toEqual(['brand', 'size', 'color']);
    l = ledger.updateLedger({ entities: [{ name: '音箱', kind: '产品', status: '待确认' }, { name: '小航', kind: '人物' }] });
    l = ledger.updateLedger({ entities: [{ name: '音箱', ref: 'm1', status: '已确认' }] });
    expect(l.entities).toEqual([{ name: '音箱', kind: '产品', ref: 'm1', status: '已确认' }, { name: '小航', kind: '人物', ref: undefined, status: undefined }]);
    l = ledger.updateLedger({ clips: [{ no: 2, seconds: 15 }, { no: 1, seconds: 15, shots: '01-04' }] });
    l = ledger.updateLedger({ clips: [{ no: 1, mediaId: 'v1', status: '已生成' }] });
    expect(l.clips.map(c => [c.no, c.seconds, c.mediaId])).toEqual([[1, 15, 'v1'], [2, 15, undefined]]);   // 补 mediaId 不会把秒数冲掉
    expect(ledger.updateLedger({ stage: 'bogus' } as any).stage).toBe('script');   // 非法阶段忽略
    const text = ledger.ledgerText(ledger.readLedger()!);
    expect(text).toContain('脚本（当前）'); expect(text).toContain('需求澄清 ✓'); expect(text).toContain('brand=SoundBox Mini');
  });
  it('injects only the current stage and the unanswered questions into the prompt', () => {
    ledger.updateLedger({ stage: 'model' });
    const block = prompt.skillBlock();
    expect(block).toContain('营销视频大师'); expect(block).toContain('商品建模（当前）');
    expect(block).toContain('"key":"shape"'); expect(block).not.toContain('"key":"brand"');   // 已回答的品牌不再问，形状还要问
    expect(block).toContain('产品图契约');
    expect(prompt.skillBlock()).toContain('建模文稿样例');   // 建模阶段带样例
    ledger.updateLedger({ stage: 'prompts' });
    expect(prompt.skillBlock()).toContain('片段提示词样例'); expect(prompt.skillBlock()).not.toContain('建模文稿样例');
    ledger.updateLedger({ stage: 'video' });
    expect(prompt.skillBlock()).not.toContain('"key":');   // 生成阶段没有问卷
    expect(prompt.skillBlock()).not.toContain('样例');
  });
});

// 参考图模板：人物七视图 / 场景空场建立镜头 / 道具单体棚拍，模型只写对象本身的描述
describe('参考图模板', () => {
  it('按分区挑模板，场景不许有人、道具只有一件', async () => {
    const { assetShotKind, scenePlatePrompt, propShotPrompt, characterSheetPrompt } = await import('./guides');
    expect(assetShotKind('人物', '林晚-形象图')).toBe('character');
    expect(assetShotKind('场景', '便利店-场景图')).toBe('scene');
    expect(assetShotKind('道具', '充电宝机柜-道具图')).toBe('prop');
    expect(assetShotKind('其他', '随手一张')).toBe(null);
    expect(assetShotKind(undefined, '街口-场景图')).toBe('scene');

    const scene = scenePlatePrompt('24 小时便利店靠窗座位区，深夜，冷白日光灯', '写实真人');
    expect(scene).toContain('没有人');            // 人由人物设定图提供，场景板必须空场
    expect(scene).toContain('不分格');
    expect(scene).toContain('画风基线：');
    expect(scene).toContain('no people');          // 给 fal 模型的英文摘要

    const prop = propShotPrompt('灰色立式共享充电宝机柜，三排空槽', '写实真人');
    expect(prop).toContain('只有这一件道具');
    expect(prop).toContain('四分之三视角');
    expect(prop).toContain('画风基线：');

    // 模型把画风基线写进描述时不会重复叠加
    expect(scenePlatePrompt('街口\n画风基线：随便写的', '写实真人').match(/画风基线：/g)!.length).toBe(1);
    expect(characterSheetPrompt('26 岁女性', '写实真人')).toContain('七视图');
  });
  it('场景与道具的验收门禁挂到每一种类型', () => {
    for (const id of ['ad', 'film', 'series', 'short', 'mv', 'other']) {
      expect(skills.skillFor(id).imageQA).toContain('场景图门禁');
      expect(skills.skillFor(id).imageQA).toContain('道具图门禁');
    }
  });

  it('每类图只用自己那条门禁，不拿人物要求去审场景道具', async () => {
    const { assetQAKind } = await import('./guides');
    const film = skills.skillFor('film');
    expect(assetQAKind('产品', '音箱-产品图')).toBe('product');
    const scene = skills.imageGateFor(film, 'scene');
    expect(scene).toContain('场景图门禁'); expect(scene).not.toContain('七视图'); expect(scene).not.toContain('人物图门禁');
    const prop = skills.imageGateFor(film, 'prop');
    expect(prop).toContain('道具图门禁'); expect(prop).not.toContain('七视图');
    expect(skills.imageGateFor(film, 'character')).toContain('七视图');
    expect(skills.imageGateFor(film, null)).toBe(skills.COMMON_IMAGE_QA);   // 认不出类型就只用通用门禁
  });
});
