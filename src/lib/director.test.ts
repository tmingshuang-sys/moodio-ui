// 导演：按纲领 / 台账 / 工作区判定唯一的下一步，并在完成且确认后推进阶段
import { beforeAll, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
let director: typeof import('./director');
let store: typeof import('./store');
let ledger: typeof import('./ledger');

beforeAll(async () => {
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, body: { classList: { add() {}, remove() {} } }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  memory.set('moodio-project-fresh::x', '1');
  director = await import('./director'); store = await import('./store'); ledger = await import('./ledger');
  store.useFiles.getState().docs.forEach(d => store.useFiles.getState().removeDoc(d.id));   // 示例文稿清掉，从零开始
});
const files = () => store.useFiles.getState();

describe('director', () => {
  it('starts with the format picker, then asks the general questions locally with nothing preselected', () => {
    expect(director.nextStep().kind).toBe('start');
    director.chooseFormat('ad');
    const chat = store.useChats.getState().chat(); const card = chat.messages[chat.messages.length - 1];
    expect(card.questions!.length).toBeGreaterThanOrEqual(4);
    expect(card.answers).toBeUndefined();                       // 新项目打开时一题都没答
    expect(card.questions![0].recommended).toEqual([0]);        // 推荐项只打标，用户点「全部用推荐值」才填
    expect(director.nextStep()).toMatchObject({ stage: 'brief', kind: 'ask' });
    director.applyAnswersToBrief({ duration: '60 秒', ratio: '竖屏 9:16', audience: '18–30 岁都市年轻人', style: '剧情故事型', look: '写实真人' });
    ledger.updateLedger({ answers: { subject: '实物产品', look: '写实真人', style: '剧情故事型', duration: '60 秒', ratio: '竖屏 9:16', audience: '18–30 岁都市年轻人' } });
    expect(files().brief.visualStyle).toBe('写实真人');   // 画风回写纲领
    expect(files().brief.duration).toBe('60 秒'); expect(files().brief.tone).toBe('剧情故事型');
    expect(director.tick()).toBe(true); expect(ledger.readLedger()!.stage).toBe('model');
  });
  it('walks model → script → assets → storyboard → prompts → video → deliver with checkpoints', () => {
    expect(director.nextStep()).toMatchObject({ stage: 'model', kind: 'ask' });          // 建模问卷没答
    ledger.updateLedger({ answers: { brand: 'SoundBox', size: '手掌大小', shape: '圆柱形', color: '黑', sellingPoints: '便携轻巧', scene: '街头', productImage: '没有，让 AI 生成' } });
    expect(director.nextStep()).toMatchObject({ stage: 'model', kind: 'agent' });        // 该写营销脑图了
    files().addDoc({ name: '营销脑图.md', content: '# 营销脑图\n## 卖点账本\n| 编号 | 卖点 | 落在哪个片段 | 状态 |\n|---|---|---|---|\n| USP-01 | 便携轻巧 | 1 | 已激活 |\n' });
    expect(director.tick()).toBe(true); expect(ledger.readLedger()!.stage).toBe('script');
    expect(director.nextStep()).toMatchObject({ stage: 'script', kind: 'agent' });
    files().addDoc({ name: '故事脚本.md', content: '# 脚本\n| 镜号 | 时长(秒) | 画面描述 |\n|---|---|---|\n' + '| 01 | 4 | 小航站在桌前犹豫要不要带大音箱 |\n'.repeat(8) });
    expect(director.nextStep()).toMatchObject({ stage: 'script', kind: 'confirm', checkpoint: 'script' });   // 检查点：脚本
    expect(director.tick()).toBe(false);
    director.confirmCheckpoint('script'); expect(ledger.readLedger()!.stage).toBe('assets');
    expect(director.nextStep()).toMatchObject({ stage: 'assets', kind: 'agent' });        // 还没列实体
    ledger.updateLedger({ entities: [{ name: '音箱', kind: '产品' }, { name: '小航', kind: '人物', ref: 'm2' }] });
    expect(director.nextStep().label).toContain('生成 1 张参考图');
    ledger.updateLedger({ entities: [{ name: '音箱', ref: 'm1' }] });
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'assets' });
    director.confirmCheckpoint('assets');
    expect(ledger.readLedger()!.entities.every(e => e.status === '已确认')).toBe(true);
    expect(ledger.readLedger()!.stage).toBe('prompts');                                     // 广告脚本已是分镜脚本表，分镜阶段自动过
    expect(director.nextStep()).toMatchObject({ stage: 'prompts', kind: 'agent' }); expect(director.nextStep().label).toContain('3 份');   // 60 秒 ÷ 20 秒：默认 Seedance 2.5，长片段优先
    files().addDoc({ name: '视频生成Prompt-01.md', content: '时长：15秒，比例：9:16。任务：生成品牌TVC。\n\n0-15秒\n拍法：固定\n画面内容：小航单手握住音箱\n品牌/产品露出：产品1在掌心，便携轻巧\n声音：{a}\n' });
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'prompts', billable: true });
    director.confirmCheckpoint('prompts'); expect(ledger.readLedger()!.stage).toBe('video');
    ledger.updateLedger({ clips: [{ no: 1, seconds: 15 }] });
    expect(director.nextStep()).toMatchObject({ stage: 'video', kind: 'agent', billable: true });
    ledger.updateLedger({ clips: [{ no: 1, mediaId: 'v1' }] });
    expect(director.nextStep().label).toBe('合成成片');
    files().addMedia({ id: 'film', name: '成片.mp4', kind: 'video', mime: 'video/mp4', size: 1, group: '其他', createdAt: Date.now(), by: 'agent', model: '本地合成' });
    expect(director.tick()).toBe(true); expect(ledger.readLedger()!.stage).toBe('deliver');
    expect(director.nextStep()).toMatchObject({ kind: 'confirm', checkpoint: 'deliver' });
    director.confirmCheckpoint('deliver'); expect(director.nextStep().kind).toBe('done');
  });
  it('blocks the prompts checkpoint on lint errors unless the gate is skipped', () => {
    ledger.updateLedger({ stage: 'prompts' }); files().removeMedia('film');
    const bad = files().docs.find(d => d.name === '视频生成Prompt-01.md')!;
    files().updateDoc(bad.id, { content: bad.content.replace('0-15秒', '0-9秒') });
    expect(director.nextStep().label).toContain('修正');
    director.skipLintGate();
    expect(ledger.readLedger()!.stage).toBe('video');
  });
  it('asks for voice samples for characters with 音色 lines, never for narrator reference images, and lets the user skip', () => {
    ledger.updateLedger({ stage: 'assets', entities: [{ name: '老周（58 岁司机）', kind: '人物', ref: 'm9' }, { name: '旁白', kind: '旁白' }] });
    files().addDoc({ name: '人物小传.md', content: '# 人物小传\n## 老周\n冻结外形描述：灰白短发、鬓角霜色，深蓝色司机制服外套\n音色：沉稳温厚的中老年男声\n## 旁白\n音色：温暖磁性的中年男声\n' });
    const step = director.nextStep();
    expect(step).toMatchObject({ stage: 'assets', kind: 'agent', billable: true, label: '生成 2 个音色样本' });
    expect(step.prompt).toContain('generate_voice'); expect(step.detail).toBe('老周、旁白');
    ledger.updateLedger({ entities: [{ name: '老周（58 岁司机）', voice: 'a1' }] });   // 带括注的实体名也算绑上了
    expect(director.nextStep().label).toBe('生成 1 个音色样本');
    director.skipVoice();
    expect(ledger.readLedger()!.flags.skipVoice).toBe(true);
    expect(director.voiceCandidates(ledger.readLedger())).toEqual([]);
  });
  it('synthesises narration before composing when the script has 旁白 lines', () => {
    ledger.updateLedger({ stage: 'video', flags: { skipVoice: false }, clips: [{ no: 1, mediaId: 'v1' }] });
    const script = files().docs.find(d => d.name === '故事脚本.md')!;
    files().updateDoc(script.id, { content: script.content + '| 02 | 4 | 街头 | 中景 | 暖 | **小航**（旁白）：每次出门都想带音乐 | 街声 | 跟拍 |\n' });
    // 片段由自带人声的模型生成：不合成旁白，直接合成成片且不传 voices
    files().addMedia({ id: 'v1', name: '片段1.mp4', kind: 'video', mime: 'video/mp4', size: 1, group: '其他', createdAt: Date.now(), by: 'agent', model: 'Seedance 2.5（BytePlus）' });
    expect(director.nextStep().label).toBe('合成成片'); expect(director.nextStep().prompt).toContain('不要传 voices');
    // 换成无声模型生成的片段：先合成旁白
    files().updateMedia('v1', { model: '可灵 1.0 标准（fal）' });
    expect(director.nextStep()).toMatchObject({ kind: 'agent', label: '合成旁白配音', billable: true });
    files().addMedia({ id: 'dub1', name: '旁白-01.mp3', kind: 'audio', mime: 'audio/mpeg', size: 1, group: '配音', createdAt: Date.now(), by: 'agent', duration: 4 });
    const step = director.nextStep(); expect(step.label).toBe('合成成片'); expect(step.prompt).toContain('dub1 旁白-01.mp3');
  });
  it('asks for the song before the assets checkpoint of an MV, composes with the song filling the film, and never chains clips', () => {
    const prevFormat = files().brief.format; files().setBrief({ format: 'mv' });
    ledger.updateLedger({ stage: 'assets', flags: { skipVoice: true }, entities: [{ name: '艺人', kind: '艺人', ref: 'm1' }] });
    expect(director.nextStep()).toMatchObject({ stage: 'assets', kind: 'upload', accept: 'audio/*' });
    files().addMedia({ id: 'song1', name: '我们的时刻.mp3', kind: 'audio', mime: 'audio/mpeg', size: 1, group: '配乐', createdAt: Date.now(), by: 'user' });
    expect(director.nextStep().kind).not.toBe('upload'); expect(director.songAudio()!.id).toBe('song1');
    ledger.updateLedger({ stage: 'video', clips: [{ no: 1, mediaId: 'v1' }] });
    const step = director.nextStep(); expect(step.label).toBe('合成成片'); expect(step.prompt).toContain('song1 我们的时刻.mp3'); expect(step.prompt).toContain('clip_volume 0'); expect(step.prompt).toContain('歌词时间轴');
    files().removeMedia('song1'); ledger.updateLedger({ stage: 'assets' });
    director.skipSong(); expect(ledger.readLedger()!.flags.skipSong).toBe(true);
    files().setBrief({ format: prevFormat });
  });
  it('autopilot never resends the identical prompt and pauses after a failed turn', () => {
    const sent: string[] = []; director.setSender(t => { sent.push(t); }); director.setAutopilot(true); director.resetAutopilot();
    expect(director.nextStep().kind).toBe('agent');
    director.autopilotTick(); expect(sent.length).toBe(1); expect(director.autopilotPaused()).toBe(false);
    director.autopilotTick(); expect(sent.length).toBe(1); expect(director.autopilotPaused()).toBe(true);   // 同一提示不重复发
    director.resetAutopilot(); expect(director.autopilotPaused()).toBe(false);
    const chat = store.useChats.getState().chat();
    store.useChats.getState().push(chat.id, { role: 'assistant', text: '模型请求失败：网络断了。未执行任何文件操作。', at: Date.now() + 5 });
    director.autopilotTick(); expect(sent.length).toBe(1); expect(director.autopilotPaused()).toBe(true);   // 上一轮出错也不自动重发
    director.setAutopilot(false);
  });
  it('follow-up suggestions follow the ledger stage instead of keyword defaults', async () => {
    const planner = await import('./agent/planner');
    ledger.updateLedger({ stage: 'prompts' });
    const m: any = { role: 'assistant', text: '两份视频生成提示词已写好，请确认按此生成。', at: Date.now(), followUps: [] };
    planner.attachFollowUps(m, '按片段提示词冻结格式写 2 份视频生成Prompt', store.useChats.getState().chat().id);
    const labels = m.followUps.map((f: any) => f.label);
    expect(labels).not.toContain('为剧本拆分镜'); expect(labels).not.toContain('生成视频提示词'); expect(labels).toContain('逐段核对片段方案');
    expect(planner.stageFallbacks('storyboard').map(f => f.label)).toContain('检查分镜节奏');
  });

  it('drops questions that were already answered, even when worded differently', () => {
    // 纲领里画风已经是「写实真人」、受众也答过：模型再问一遍（换措辞也算）要被丢掉，只留真正的新问题
    const kept = director.dropAnsweredQuestions([
      { text: '画风走哪种？', type: 'single', options: [{ label: '写实真人' }, { label: '3D 动画' }], multi: false, key: 'look' },
      { text: '主要给谁看？', type: 'single', options: [{ label: '学生' }], multi: false },
      { text: '有没有特别想避免的画面？', type: 'text', options: [], multi: false },
    ]);
    expect(kept.map(q => q.text)).toEqual(['有没有特别想避免的画面？']);
  });

  it('keeps asset generation out of the modeling and script stages', () => {
    const plan = [{ tool: 'write_doc' }, { tool: 'generate_image' }, { tool: 'generate_voice' }];
    const inModel = director.stripEarlyAssets(plan, '请写人物小传和世界观', 'model');
    expect(inModel.skipped).toBe(2); expect(inModel.plan.map(a => a.tool)).toEqual(['write_doc']);
    // 素材检查阶段照常生成
    expect(director.stripEarlyAssets(plan, '按实体清单生成参考图', 'assets').skipped).toBe(0);
    // 用户这一轮自己要求出图时不拦
    expect(director.stripEarlyAssets(plan, '先给我生成一张林晚的形象图', 'model').skipped).toBe(0);
    // 没有台账（自由对话）也不拦
    expect(director.stripEarlyAssets(plan, '随便画点什么', undefined).skipped).toBe(0);
  });
});
