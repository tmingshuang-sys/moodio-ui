// ===== Agent 的「手」：能对工作区里的文件做的操作。执行前必须确认（NO_CONFIRM_TOOLS 除外），删除类进回收站可撤销 =====
import type { Action, Artifact, MessageAction, PlanStep, MediaItem } from '../types';
import { useFiles, findDoc, findMedia } from '../store';
import { projects } from '../projects';
import { appendMarkdown, findSection, replaceSection, ensureExt, docRole, sanitizeName, wordCount, baseName } from '../markdown';
import { downloadText } from '../storage';
import { BRIEF_FIELDS, BRIEF_FORMATS, styleBaseline, applyStyleBaseline, characterSheetPrompt, scenePlatePrompt, propShotPrompt, assetShotKind } from '../guides';
import { generateImage, generateVideo, designVoice, generateSpeech, mediaReadyReason, fallbackNote, videoProfile, DEFAULT_VOICE_ID } from '../mediagen';
import { captureFrame } from '../frames';
import type { GenResult } from '../mediagen';
import type { RatioKey } from '../mediamodels';
import { IMAGE_RATIOS, VIDEO_RATIOS, presetByName } from '../mediamodels';
import { updateLedger, readLedger } from '../ledger';
import { skillFor, stageName } from '../skills';
import { composeVideos } from '../compose';
import { askAboutImages } from '../vision';
import { makeSheet } from '../sheet';
import { lintClips, lintSummary } from '../lint';

// 按名字找台账实体：先全等，再按去掉括注的前缀对（模型常把「林小满（26 岁…）」简写成「林小满」）
function matchEntity(name: string) {
  const ents = readLedger()?.entities || []; const n = name.replace(/[（(].*$/, '').trim();
  return ents.find(e => e.name === name) || ents.find(e => e.name.replace(/[（(].*$/, '').trim() === n) || ents.find(e => e.name.startsWith(n) || n.startsWith(e.name.replace(/[（(].*$/, '').trim())) || null;
}
export interface ToolResult { summary: string; content?: string; actions?: MessageAction[]; review?: { docId: string; title: string } | null; artifact?: Artifact; }
export interface ToolContext {
  request: string; chatId: string;
  typeInto: (docId: string, from: string, to: string) => Promise<void>;   // 在工作区里逐行写入（执行器提供）
  step: (label: string, fn?: () => Promise<void> | void) => Promise<void>;   // 子步骤记录
  live: (text: string) => void;   // 状态胶囊文案（生成图片 / 视频时报进度）
  signal?: AbortSignal;
  messageAt?: number; stepIndex?: number;   // 正在执行的是哪条消息的第几步（后台任务完成后补回去）
}
export type ToolFn = (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult | string>;

export const NO_CONFIRM_TOOLS = new Set(['read_doc', 'open_doc', 'open_media', 'export_doc', 'save_brief', 'update_ledger', 'inspect_image', 'lint_clips']);
export const GENERATE_TOOLS = new Set(['generate_image', 'generate_video', 'generate_voice', 'generate_speech', 'compose_video']);   // 自动模式下不用确认
export const DESTRUCTIVE_TOOLS = new Set(['delete_doc', 'delete_media']);

function requireDoc(id: unknown) { const d = findDoc(String(id || '').trim()); if (!d) throw new Error(`找不到 id 为「${id}」的文稿，请从文件清单里选择`); return d; }
function requireMedia(id: unknown) { const m = findMedia(String(id || '').trim()); if (!m) throw new Error(`找不到 id 为「${id}」的图片或视频`); return m; }
const openDocAction = (id: string, name: string): MessageAction => ({ id: 'open-doc:' + id, label: `打开「${baseName(name).slice(0, 14)}」` });
const docArtifact = (id: string, name: string): Artifact => ({ id, kind: 'doc', name });

export function saveBrief(fields: Record<string, any>): string[] {
  const next: Record<string, any> = {}; const saved: string[] = [];
  BRIEF_FIELDS.forEach(([k, label]) => {
    if (fields[k] === undefined || fields[k] === null) return;
    let v = String(fields[k]).trim();
    if (k === 'format') { const key = Object.keys(BRIEF_FORMATS).find(x => x === v || BRIEF_FORMATS[x] === v); v = key || v; }
    next[k] = v; if (v) saved.push(label);
  });
  useFiles.getState().setBrief(next);
  return saved;
}

export const AGENT_TOOLS: Record<string, ToolFn> = {
  // ---- 追问与纲领 ----
  async save_brief(args) { const saved = saveBrief(args || {}); return saved.length ? `已记录创作纲领：${saved.join('、')}` : '创作纲领没有变化'; },
  async ask_user() { return '（追问已展示给用户）'; },
  // 台账：阶段推进 / 答案 / 实体 / 片段，免确认
  async update_ledger(args) {
    // 进入「生成成片」前把关：时长与卖点落地有错就不推进
    if (args?.stage === 'video' && !readLedger()?.flags?.skipLint) { const r = lintClips(); if (r.errors.length) throw new Error(`还不能进入生成成片：${r.errors.join('；')}（可在校验卡上选择跳过）`); }
    const l = updateLedger(args || {}); const parts = []; if (args?.stage) parts.push(`阶段 → ${stageName(skillFor(l.skill), l.stage)}`); if (args?.answers) parts.push(`答案 ${Object.keys(args.answers).length} 项`); if (args?.entities) parts.push(`实体 ${l.entities.length} 个`); if (args?.clips) parts.push(`片段 ${l.clips.length} 段`); return `台账已更新${parts.length ? '：' + parts.join('，') : ''}`; },
  // ---- 读取与打开（不需要确认）----
  async read_doc(args) { const d = requireDoc(args.id); return { summary: `已读取「${d.name}」（${wordCount(d.content)} 字）`, content: d.content.slice(0, 16000), actions: [openDocAction(d.id, d.name)] }; },
  async open_doc(args) { const d = requireDoc(args.id); useFiles.getState().openInPane(d.id); return `已打开「${d.name}」`; },
  async open_media(args) { const m = requireMedia(args.id); useFiles.getState().openInPane(m.id); return `已打开「${m.name}」`; },
  // 校验片段提示词（不需要确认），结果交回模型
  async lint_clips() { const r = lintClips(); const text = lintSummary(r); return { summary: r.errors.length ? `片段校验有 ${r.errors.length} 处问题` : '片段校验通过', content: text }; },
  // 拼图：几张参考图拼成一张带标签的分格图
  async make_sheet(args, ctx) {
    const tiles = (Array.isArray(args.tiles) ? args.tiles : []).map((t: any) => ({ id: String(t?.id || '').trim(), label: String(t?.label || '').trim() || '视图' })).filter((t: any) => t.id);
    if (!tiles.length) throw new Error('缺少要拼的图片');
    tiles.forEach((t: any) => { const m = requireMedia(t.id); if (m.kind !== 'image') throw new Error(`「${m.name}」不是图片`); });
    let item!: import('../types').MediaItem;
    await ctx.step(`把 ${tiles.length} 张图拼成「${args.name || '三视图'}」`, async () => { item = await makeSheet(tiles, { name: String(args.name || '三视图'), group: String(args.group || '产品') }); });
    useFiles.getState().openInPane(item.id);
    return { summary: `已把 ${tiles.length} 张图拼成「${item.name}」`, actions: [{ id: 'open-media:' + item.id, label: '查看' }], artifact: { id: item.id, kind: 'image', name: item.name } };
  },
  // 看图（不需要确认）：用视觉模型描述或检查一张图片，结果交回模型再规划
  async inspect_image(args, ctx) {
    const m = requireMedia(args.id); if (m.kind !== 'image') throw new Error(`「${m.name}」不是图片`);
    const question = String(args.question || '').trim() || '描述这张图的主体、动作、环境、光线与风格，指出任何明显的畸形或错误。只输出 JSON：{"description":"描述","issues":["问题"]}';
    let content = '';
    await ctx.step(`查看「${m.name}」`, async () => { const r = await askAboutImages([m.id], question, undefined, ctx.signal); content = typeof r === 'string' ? r : JSON.stringify(r, null, 1); });
    return { summary: `已查看「${m.name}」`, content: content.slice(0, 4000), actions: [{ id: 'open-media:' + m.id, label: '查看' }] };
  },
  async export_doc(args) { const d = requireDoc(args.id); downloadText(d.name, d.content, d.kind === 'json' ? 'application/json' : 'text/markdown'); return `已下载「${d.name}」`; },
  // ---- 文稿 ----
  async write_doc(args, ctx) {
    const name = ensureExt(sanitizeName(String(args.name || '未命名')), 'md');
    const content = String(args.content || '').trim(); if (!content) throw new Error('缺少文稿内容');
    const files = useFiles.getState();
    const existing = files.docs.find(d => d.name.toLowerCase() === name.toLowerCase());
    if (existing && args.overwrite) {
      await ctx.step(`重写「${existing.name}」`, () => ctx.typeInto(existing.id, '', content + '\n'));
      return { summary: `已重写「${existing.name}」（${wordCount(content)} 字）`, actions: [openDocAction(existing.id, existing.name)], review: docRole(existing.name) === 'script' ? { docId: existing.id, title: existing.name } : null, artifact: docArtifact(existing.id, existing.name) };
    }
    const doc = files.addDoc({ name, content: '', by: 'agent', chatId: ctx.chatId });
    await ctx.step(`新建「${doc.name}」并写入正文`, () => ctx.typeInto(doc.id, '', content + '\n'));
    return { summary: `已写入「${doc.name}」（${wordCount(content)} 字）`, actions: [openDocAction(doc.id, doc.name)], review: docRole(doc.name) === 'script' ? { docId: doc.id, title: doc.name } : null, artifact: docArtifact(doc.id, doc.name) };
  },
  async append_doc(args, ctx) {
    const d = requireDoc(args.id); const extra = String(args.content || '').trim(); if (!extra) throw new Error('缺少要追加的内容');
    const next = appendMarkdown(d.content, extra);
    await ctx.step(`在「${d.name}」末尾续写`, () => ctx.typeInto(d.id, d.content, next));
    return { summary: `已在「${d.name}」末尾追加 ${wordCount(extra)} 字`, actions: [openDocAction(d.id, d.name)], review: docRole(d.name) === 'script' ? { docId: d.id, title: d.name } : null, artifact: docArtifact(d.id, d.name) };
  },
  async replace_section(args, ctx) {
    const d = requireDoc(args.id); const heading = String(args.heading || '').trim(); const content = String(args.content || '').trim();
    if (!heading) throw new Error('缺少要替换的章节标题'); if (!content) throw new Error('缺少新的章节内容');
    const s = findSection(d.content, heading); if (!s) throw new Error(`「${d.name}」里找不到标题「${heading}」，请先 read_doc 确认标题`);
    const next = replaceSection(d.content, s, content);
    await ctx.step(`改写「${d.name}」的「${s.heading}」`, () => ctx.typeInto(d.id, d.content, next));
    return { summary: `已改写「${d.name}」的章节「${s.heading}」`, actions: [openDocAction(d.id, d.name)], review: docRole(d.name) === 'script' ? { docId: d.id, title: d.name } : null, artifact: docArtifact(d.id, d.name) };
  },
  async rename_doc(args) { const d = requireDoc(args.id); const name = String(args.name || '').trim(); if (!name) throw new Error('缺少新名称'); const old = d.name; useFiles.getState().renameDoc(d.id, name); const now = findDoc(d.id)!; return { summary: `已把「${old}」重命名为「${now.name}」`, actions: [openDocAction(d.id, now.name)] }; },
  async delete_doc(args) { const d = requireDoc(args.id); const entry = useFiles.getState().removeDoc(d.id); return { summary: `已删除「${d.name}」，已放入回收站，7 天内可恢复`, actions: entry ? [{ id: 'restore-trash:' + entry.trashId, label: '撤销删除' }] : [] }; },
  // ---- 媒体 ----
  async rename_media(args) { const m = requireMedia(args.id); const name = sanitizeName(String(args.name || '')); if (!name) throw new Error('缺少新名称'); const ext = m.name.includes('.') ? m.name.slice(m.name.lastIndexOf('.')) : ''; const finalName = /\.[a-z0-9]{2,5}$/i.test(name) ? name : name + ext; useFiles.getState().updateMedia(m.id, { name: finalName }); return { summary: `已把「${m.name}」重命名为「${finalName}」`, actions: [{ id: 'open-media:' + m.id, label: '查看' }] }; },
  async tag_media(args) { const m = requireMedia(args.id); const group = sanitizeName(String(args.group || '其他')); useFiles.getState().updateMedia(m.id, { group }); return `已把「${m.name}」归入「${group}」分区`; },
  async delete_media(args) { const m = requireMedia(args.id); const entry = useFiles.getState().removeMedia(m.id); return { summary: `已删除「${m.name}」，已放入回收站，7 天内可恢复`, actions: entry ? [{ id: 'restore-trash:' + entry.trashId, label: '撤销删除' }] : [] }; },
  // ---- 生成图片 / 视频（经网关调用 fal，结果直接进媒体库）----
  async generate_image(args, ctx) {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    // 画风基线固定附在提示词末尾：不管模型怎么写，同一创作的参考图都是同一种画风（真人就都真人，不会一张真人一张卡通）
    const visualStyle = useFiles.getState().brief?.visualStyle; const baseline = styleBaseline(visualStyle);
    // 参考图按分区自动套模板，模型给的提示词只当「这个东西本身」的描述用：
    // 人物 → 七视图设定图（16:9）；场景 → 空场建立镜头（跟纲领画幅，可直接当首帧）；道具 → 单体棚拍（1:1）；其余只附画风基线
    const shot = args.no_sheet ? null : assetShotKind(args.group, args.name);
    const desc = String(args.prompt || '');
    const prompt = shot === 'character' ? characterSheetPrompt(desc, visualStyle)
      : shot === 'scene' ? scenePlatePrompt(desc, visualStyle)
      : shot === 'prop' ? propShotPrompt(desc, visualStyle)
      : applyStyleBaseline(desc, visualStyle);
    const asked: RatioKey | undefined = IMAGE_RATIOS.includes(args.ratio) ? (args.ratio as RatioKey) : undefined;
    const briefRatio = IMAGE_RATIOS.find(r => String(useFiles.getState().brief?.ratio || '').includes(r));
    const ratio: RatioKey | undefined = shot === 'character' ? '16:9' : shot === 'prop' ? '1:1' : shot === 'scene' ? (asked || briefRatio) : asked;
    const shotNote = shot === 'character' ? '七视图设定图' : shot === 'scene' ? '场景板（空场建立镜头）' : shot === 'prop' ? '道具图（单体棚拍）' : '';
    let r!: GenResult;
    await ctx.step(`生成图片「${String(args.name || args.prompt || '').slice(0, 20)}」${shotNote ? `（${shotNote}）` : ''}`, async () => {
      r = await generateImage({ prompt, name: args.name ? String(args.name) : undefined, group: args.group ? String(args.group) : undefined, ratio }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    useFiles.getState().openInPane(r.item.id);
    return { summary: `已用 ${r.model.name} 生成图片「${r.item.name}」并存入媒体库${fallbackNote(r)}（${shotNote ? shotNote + '，' : ''}画风基线：${baseline.replace(/（.*$/, '')}）`, actions: [{ id: 'open-media:' + r.item.id, label: '查看' }], artifact: { id: r.item.id, kind: 'image', name: r.item.name, prompt } };
  },
  async generate_video(args, ctx) {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    const notes: string[] = [];
    let fromMediaId = args.from_media_id ? String(args.from_media_id) : undefined;
    if (!fromMediaId && args.from_video_id) {   // 分镜接续：截上一段的末帧当这一段的首帧（本地截帧，不计费）
      const prev = requireMedia(String(args.from_video_id)); if (prev.kind !== 'video') throw new Error(`「${prev.name}」不是视频，不能取末帧`);
      let frame!: MediaItem;
      await ctx.step(`截取「${prev.name}」的末帧作首帧`, async () => { frame = await captureFrame(prev.id, 'last'); });
      fromMediaId = frame.id; notes.push(`首帧接自「${prev.name}」的末帧（关键帧图「${frame.name}」）`);
    }
    let toMediaId = args.to_media_id ? String(args.to_media_id) : undefined;
    if (toMediaId && !fromMediaId) { notes.push('没有首帧，已忽略尾帧图'); toMediaId = undefined; }
    if (toMediaId && videoProfile().keyframes !== 'both') { notes.push('当前图生视频模型不收尾帧图，已忽略 to_media_id'); toMediaId = undefined; }
    let r!: GenResult;
    await ctx.step(`生成视频「${String(args.name || args.prompt || '').slice(0, 20)}」`, async () => {
      r = await generateVideo({ prompt: String(args.prompt || ''), name: args.name ? String(args.name) : undefined, group: args.group ? String(args.group) : undefined, ratio: VIDEO_RATIOS.includes(args.ratio) ? (args.ratio as RatioKey) : undefined, duration: args.duration as string | number | undefined, fromMediaId, toMediaId }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    useFiles.getState().openInPane(r.item.id);
    return { summary: `已用 ${r.model.name} 生成视频「${r.item.name}」并存入媒体库${fallbackNote(r)}${notes.length ? '（' + notes.join('；') + '）' : ''}`, actions: [{ id: 'open-media:' + r.item.id, label: '查看' }], artifact: { id: r.item.id, kind: 'video', name: r.item.name, prompt: String(args.prompt || '') } };
  },
  // 设计音色样本：按人物小传的音色行生成一段试听，并绑到台账实体的 voice 上（合成配音时用它的 voice id）
  async generate_voice(args, ctx) {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    const entity = String(args.entity || args.name || '').trim(); if (!entity) throw new Error('缺少角色名（entity）');
    const description = String(args.description || '').trim(); if (!description) throw new Error('缺少音色描述（description）');
    let r!: GenResult;
    await ctx.step(`设计「${entity}」的音色样本`, async () => {
      r = await designVoice({ name: entity, description, sample: String(args.sample || '') }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    const target = matchEntity(entity);   // 台账里的实体名可能带括注（林小满（26 岁…）），按前缀对上就绑到它
    updateLedger({ entities: [{ name: target?.name || entity, kind: target?.kind || (/旁白|画外音/.test(entity) ? '旁白' : '人物'), voice: r.item.id }] });
    useFiles.getState().openInPane(r.item.id);
    return { summary: `已为「${entity}」设计音色样本「${r.item.name}」并绑定到台账实体（voice）`, actions: [{ id: 'open-media:' + r.item.id, label: '试听' }], artifact: { id: r.item.id, kind: 'audio', name: r.item.name, prompt: description } };
  },
  // 合成配音：旁白或台词。entity 给了就用它绑定的音色样本，否则用 voice_media_id 指定的样本；都没有就用预置音色，不让流程卡住
  async generate_speech(args, ctx) {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    const text = String(args.text || '').trim(); if (!text) throw new Error('缺少要合成的文本（text）');
    const entity = String(args.entity || '').trim();
    let sampleId = args.voice_media_id ? String(args.voice_media_id).trim() : '';
    if (!sampleId && entity) sampleId = matchEntity(entity)?.voice || '';
    const sample = sampleId ? requireMedia(sampleId) : null;
    if (sample && sample.kind !== 'audio') throw new Error(`「${sample.name}」不是音频，不能当音色样本`);
    const voiceId = sample?.voiceId;
    if (sample && !voiceId) throw new Error(`「${sample.name}」没有 voice id（不是用 generate_voice 设计的样本），请先为「${entity || '该角色'}」设计音色`);
    const name = args.name ? String(args.name) : `${entity || '配音'}-${text.slice(0, 10)}`;
    let r!: GenResult;
    await ctx.step(`合成配音「${name.slice(0, 20)}」（${text.length} 字）`, async () => {
      r = await generateSpeech({ text, voiceId, name, group: args.group ? String(args.group) : undefined, speed: args.speed !== undefined ? Number(args.speed) : undefined, emotion: args.emotion ? String(args.emotion) : undefined }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    useFiles.getState().openInPane(r.item.id);
    const secs = r.item.duration ? `，${r.item.duration.toFixed(1)} 秒` : '';
    return { summary: `已用 ${r.model.name} 合成配音「${r.item.name}」（${voiceId ? '音色：' + (entity || sample!.name) : '预置音色 ' + DEFAULT_VOICE_ID}${secs}）并存入媒体库${fallbackNote(r)}`, actions: [{ id: 'open-media:' + r.item.id, label: '试听' }], artifact: { id: r.item.id, kind: 'audio', name: r.item.name, prompt: text } };
  },
  // 把若干段视频按顺序合成一条成片（浏览器本地合成，不计费，耗时约等于总时长）
  async compose_video(args, ctx) {
    const ids = (Array.isArray(args.clip_ids) ? args.clip_ids : []).map((x: unknown) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) throw new Error('缺少要合成的片段 id');
    const clips = ids.map(id => { const m = requireMedia(id); if (m.kind !== 'video') throw new Error(`「${m.name}」不是视频`); return m; });
    const musicId = args.music_id ? String(args.music_id).trim() : ''; if (musicId) { const mu = requireMedia(musicId); if (mu.kind !== 'audio') throw new Error(`「${mu.name}」不是音频，不能当配乐`); }
    const subtitles = Array.isArray(args.subtitles) ? args.subtitles : [];
    let voices = (Array.isArray(args.voices) ? args.voices : []).map((v: any) => ({ id: String(v?.media_id || v?.id || '').trim(), start: Math.max(0, Number(v?.start) || 0), volume: v?.volume !== undefined ? Number(v.volume) : undefined })).filter((v: { id: string }) => v.id);
    for (const v of voices) { const a = requireMedia(v.id); if (a.kind !== 'audio') throw new Error(`「${a.name}」不是音频，不能当配音`); }
    // 片段自带人声（Seedance 2.x、Veo 3）时不再叠配音轨，否则同一句台词会出现两遍
    const nativeClips = clips.filter(c => !!presetByName(c.model)?.nativeAudio); let voiceNote = '';
    if (voices.length && nativeClips.length && Number(args.clip_volume ?? 1) > 0) { voiceNote = `（${nativeClips.length} 段片段自带人声，已忽略 ${voices.length} 条配音轨，避免台词叠两遍）`; voices = []; }
    let item!: import('../types').MediaItem;
    await ctx.step(`合成 ${clips.length} 段视频为成片${subtitles.length ? `（${subtitles.length} 条字幕）` : ''}${voices.length ? `（${voices.length} 条配音）` : ''}${musicId ? '（配乐）' : ''}`, async () => { item = await composeVideos(clips.map(c => c.id), { name: String(args.name || '成片'), onProgress: ctx.live, signal: ctx.signal, musicId: musicId || undefined, musicVolume: args.music_volume !== undefined ? Number(args.music_volume) : undefined, subtitles, voices, clipVolume: args.clip_volume !== undefined ? Number(args.clip_volume) : undefined, format: args.format === 'webm' ? 'webm' : 'mp4' }); });
    useFiles.getState().openInPane(item.id);
    return { summary: `已把 ${clips.length} 段视频按顺序合成为「${item.name}」${subtitles.length ? `，含 ${subtitles.length} 条字幕` : ''}${voices.length ? `，${voices.length} 条配音` : ''}${musicId ? '，已配乐' : ''}${voiceNote}`, actions: [{ id: 'open-media:' + item.id, label: '查看成片' }, { id: 'jianying:' + item.id, label: '导入到剪辑软件' }], artifact: { id: item.id, kind: 'video', name: item.name } };
  },
  // ---- 项目 ----
  async create_project(args) { const p = projects.create(String(args.title || '新项目')); return `已新建项目「${p.title}」，页面即将重新加载`; },
  async switch_project(args) { const p = projects.list().find(x => x.id === String(args.id || '')); if (!p) throw new Error(`找不到 id 为「${args.id}」的项目`); projects.switchTo(p.id); return `正在切换到项目「${p.title}」`; },
  async rename_project(args) { const p = projects.list().find(x => x.id === String(args.id || '')) || projects.active(); const title = String(args.title || '').trim(); if (!title) throw new Error('缺少新名称'); const old = p.title; projects.rename(p.id, title); return `已把项目「${old}」重命名为「${title}」`; },
};

// ===== 计划卡：把 actions 变成可读的步骤（标题 / 预览 / 图标类别 / 删除标记）=====
const PLAN_KIND: Record<string, string> = { write_doc: 'write', append_doc: 'write', replace_section: 'write', rename_doc: 'doc', delete_doc: 'delete', read_doc: 'doc', open_doc: 'doc', export_doc: 'export', open_media: 'media', rename_media: 'media', tag_media: 'media', delete_media: 'delete', generate_image: 'image', generate_video: 'video', generate_voice: 'audio', generate_speech: 'audio', compose_video: 'video', inspect_image: 'media', make_sheet: 'image', lint_clips: 'doc', create_project: 'project', switch_project: 'project', rename_project: 'project', save_brief: 'brief', ask_user: 'brief', update_ledger: 'brief' };
export function planKind(tool: string) { return PLAN_KIND[tool] || 'other'; }

export function describeAction(a: Action): string {
  const g = a?.args || {}; const docName = (id: unknown) => findDoc(String(id || ''))?.name || String(id || '');
  const mediaName = (id: unknown) => findMedia(String(id || ''))?.name || String(id || '');
  switch (a?.tool) {
    case 'write_doc': { const name = ensureExt(sanitizeName(String(g.name || '未命名')), 'md'); const exists = useFiles.getState().docs.some(d => d.name.toLowerCase() === name.toLowerCase()); return `${exists && g.overwrite ? '重写' : '新建'}文稿「${name}」` + (g.content ? `（约 ${wordCount(String(g.content))} 字）` : ''); }
    case 'append_doc': return `在「${docName(g.id)}」末尾续写` + (g.content ? `（约 ${wordCount(String(g.content))} 字）` : '');
    case 'replace_section': return `改写「${docName(g.id)}」的章节「${g.heading || ''}」`;
    case 'rename_doc': return `把「${docName(g.id)}」重命名为「${g.name || ''}」`;
    case 'delete_doc': return `删除文稿「${docName(g.id)}」（进回收站，可撤销）`;
    case 'read_doc': return `读取「${docName(g.id)}」`;
    case 'open_doc': return `打开「${docName(g.id)}」`;
    case 'export_doc': return `下载「${docName(g.id)}」`;
    case 'open_media': return `查看「${mediaName(g.id)}」`;
    case 'make_sheet': { const n = Array.isArray(g.tiles) ? g.tiles.length : 0; return `把 ${n} 张图拼成带标签的分格图「${g.name || '三视图'}」`; }
    case 'lint_clips': return '校验片段提示词的时长与卖点落地';
    case 'inspect_image': return `用视觉模型看「${mediaName(g.id)}」${g.question ? '：' + String(g.question).slice(0, 30) : ''}`;
    case 'rename_media': return `把「${mediaName(g.id)}」重命名为「${g.name || ''}」`;
    case 'tag_media': return `把「${mediaName(g.id)}」归入「${g.group || '其他'}」分区`;
    case 'delete_media': return `删除「${mediaName(g.id)}」（进回收站，可撤销）`;
    case 'generate_image': return `生成图片「${String(g.name || g.prompt || '').slice(0, 20)}」` + (IMAGE_RATIOS.includes(g.ratio) ? `（${g.ratio}）` : '');
    case 'generate_video': { const from = g.from_video_id ? `接「${mediaName(g.from_video_id)}」的末帧` : g.from_media_id ? `以「${mediaName(g.from_media_id)}」为首帧${g.to_media_id ? '、「' + mediaName(g.to_media_id) + '」为尾帧' : ''}` : (VIDEO_RATIOS.includes(g.ratio) ? String(g.ratio) : ''); const secs = String(g.duration || '').replace(/[^0-9]/g, ''); const parts = [from, secs ? `${secs} 秒` : '智能时长'].filter(Boolean); return `生成视频「${String(g.name || g.prompt || '').slice(0, 20)}」（${parts.join(' · ')}）`; }
    case 'generate_voice': return `设计「${String(g.entity || g.name || '').slice(0, 12)}」的音色样本`;
    case 'generate_speech': { const txt = String(g.text || ''); return `合成配音「${String(g.name || g.entity || '配音').slice(0, 16)}」（${txt.length} 字${g.entity ? '，音色：' + String(g.entity).slice(0, 8) : ''}）`; }
    case 'save_brief': return '记录创作纲领';
    case 'ask_user': return '向你确认几个问题';
    case 'update_ledger': { const parts = []; if (g.stage) parts.push(`阶段推进到「${stageName(skillFor(String(g.skill || useFiles.getState().brief?.format || 'other')), g.stage)}」`); if (g.answers) parts.push('记录答案'); if (g.entities) parts.push('更新实体清单'); if (g.clips) parts.push('更新片段清单'); return `更新台账${parts.length ? '：' + parts.join('、') : ''}`; }
    case 'compose_video': { const n = Array.isArray(g.clip_ids) ? g.clip_ids.length : 0; const subs = Array.isArray(g.subtitles) ? g.subtitles.length : 0; const vo = Array.isArray(g.voices) ? g.voices.length : 0; return `把 ${n} 段视频按顺序合成 MP4 成片「${g.name || '成片'}」${subs ? `，${subs} 条字幕` : ''}${vo ? `，${vo} 条配音` : ''}${g.music_id ? '，配乐「' + mediaName(g.music_id) + '」' : ''}（本地合成，约需成片总时长的时间）`; }
    case 'create_project': return `新建空白项目「${g.title || '新项目'}」并切换过去（页面会重新加载）`;
    case 'switch_project': { const p = projects.list().find(x => x.id === String(g.id || '')); return `切换到项目「${p ? p.title : g.id}」（页面会重新加载）`; }
    case 'rename_project': { const p = projects.list().find(x => x.id === String(g.id || '')) || projects.active(); return `把项目「${p.title}」重命名为「${g.title || ''}」`; }
    default: return '执行 ' + (a?.tool || '未知操作');
  }
}

export function previewAction(a: Action): string {
  const g = a?.args || {};
  if (['generate_image', 'generate_video'].includes(a?.tool) && g.prompt) return String(g.prompt).slice(0, 400);
  if (a?.tool === 'generate_voice') return [g.description, g.sample ? '试听：' + g.sample : ''].filter(Boolean).join('\n').slice(0, 400);
  if (a?.tool === 'generate_speech' && g.text) return String(g.text).slice(0, 400);
  if (['write_doc', 'append_doc', 'replace_section'].includes(a?.tool) && g.content) {
    const lines = String(g.content).split('\n').map(l => l.trim()).filter(Boolean);
    const shown = lines.slice(0, 6).map(l => l.slice(0, 60)); if (lines.length > 6) shown.push(`…（共 ${lines.length} 行）`);
    return shown.join('\n');
  }
  return '';
}

export function planSteps(plan: Action[]): PlanStep[] {
  return (Array.isArray(plan) ? plan : []).map(a => ({ tool: a.tool, kind: planKind(a.tool), title: describeAction(a), preview: previewAction(a), destructive: DESTRUCTIVE_TOOLS.has(a.tool), status: 'pending', result: '', logs: [] }));
}
