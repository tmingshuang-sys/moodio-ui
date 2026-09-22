// ===== Agent 的「手」：能对工作区里的文件做的操作。执行前必须确认（NO_CONFIRM_TOOLS 除外），删除类进回收站可撤销 =====
import type { Action, Artifact, MessageAction, PlanStep } from '../types';
import { useFiles, findDoc, findMedia } from '../store';
import { projects } from '../projects';
import { appendMarkdown, findSection, replaceSection, ensureExt, docRole, sanitizeName, wordCount, baseName } from '../markdown';
import { downloadText } from '../storage';
import { BRIEF_FIELDS, BRIEF_FORMATS } from '../guides';
import { generateImage, generateVideo, mediaReadyReason, fallbackNote } from '../mediagen';
import type { GenResult } from '../mediagen';
import type { RatioKey } from '../mediamodels';
import { IMAGE_RATIOS, VIDEO_RATIOS } from '../mediamodels';
import { updateLedger } from '../ledger';
import { skillFor, stageName } from '../skills';
import { composeVideos } from '../compose';
import { askAboutImages } from '../vision';

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

export const NO_CONFIRM_TOOLS = new Set(['read_doc', 'open_doc', 'open_media', 'export_doc', 'save_brief', 'update_ledger', 'inspect_image']);
export const GENERATE_TOOLS = new Set(['generate_image', 'generate_video', 'compose_video']);   // 自动模式下不用确认
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
  async update_ledger(args) { const l = updateLedger(args || {}); const parts = []; if (args?.stage) parts.push(`阶段 → ${stageName(skillFor(l.skill), l.stage)}`); if (args?.answers) parts.push(`答案 ${Object.keys(args.answers).length} 项`); if (args?.entities) parts.push(`实体 ${l.entities.length} 个`); if (args?.clips) parts.push(`片段 ${l.clips.length} 段`); return `台账已更新${parts.length ? '：' + parts.join('，') : ''}`; },
  // ---- 读取与打开（不需要确认）----
  async read_doc(args) { const d = requireDoc(args.id); return { summary: `已读取「${d.name}」（${wordCount(d.content)} 字）`, content: d.content.slice(0, 16000), actions: [openDocAction(d.id, d.name)] }; },
  async open_doc(args) { const d = requireDoc(args.id); useFiles.getState().openInPane(d.id); return `已打开「${d.name}」`; },
  async open_media(args) { const m = requireMedia(args.id); useFiles.getState().openInPane(m.id); return `已打开「${m.name}」`; },
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
    let r!: GenResult;
    await ctx.step(`生成图片「${String(args.name || args.prompt || '').slice(0, 20)}」`, async () => {
      r = await generateImage({ prompt: String(args.prompt || ''), name: args.name ? String(args.name) : undefined, group: args.group ? String(args.group) : undefined, ratio: IMAGE_RATIOS.includes(args.ratio) ? (args.ratio as RatioKey) : undefined }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    useFiles.getState().openInPane(r.item.id);
    return { summary: `已用 ${r.model.name} 生成图片「${r.item.name}」并存入媒体库${fallbackNote(r)}`, actions: [{ id: 'open-media:' + r.item.id, label: '查看' }], artifact: { id: r.item.id, kind: 'image', name: r.item.name, prompt: String(args.prompt || '') } };
  },
  async generate_video(args, ctx) {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    let r!: GenResult;
    await ctx.step(`生成视频「${String(args.name || args.prompt || '').slice(0, 20)}」`, async () => {
      r = await generateVideo({ prompt: String(args.prompt || ''), name: args.name ? String(args.name) : undefined, group: args.group ? String(args.group) : undefined, ratio: VIDEO_RATIOS.includes(args.ratio) ? (args.ratio as RatioKey) : undefined, duration: args.duration as string | number | undefined, fromMediaId: args.from_media_id ? String(args.from_media_id) : undefined }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
    });
    useFiles.getState().openInPane(r.item.id);
    return { summary: `已用 ${r.model.name} 生成视频「${r.item.name}」并存入媒体库${fallbackNote(r)}`, actions: [{ id: 'open-media:' + r.item.id, label: '查看' }], artifact: { id: r.item.id, kind: 'video', name: r.item.name, prompt: String(args.prompt || '') } };
  },
  // 把若干段视频按顺序合成一条成片（浏览器本地合成，不计费，耗时约等于总时长）
  async compose_video(args, ctx) {
    const ids = (Array.isArray(args.clip_ids) ? args.clip_ids : []).map((x: unknown) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) throw new Error('缺少要合成的片段 id');
    const clips = ids.map(id => { const m = requireMedia(id); if (m.kind !== 'video') throw new Error(`「${m.name}」不是视频`); return m; });
    const musicId = args.music_id ? String(args.music_id).trim() : ''; if (musicId) { const mu = requireMedia(musicId); if (mu.kind !== 'audio') throw new Error(`「${mu.name}」不是音频，不能当配乐`); }
    const subtitles = Array.isArray(args.subtitles) ? args.subtitles : [];
    let item!: import('../types').MediaItem;
    await ctx.step(`合成 ${clips.length} 段视频为成片${subtitles.length ? `（${subtitles.length} 条字幕）` : ''}${musicId ? '（配乐）' : ''}`, async () => { item = await composeVideos(clips.map(c => c.id), { name: String(args.name || '成片'), onProgress: ctx.live, signal: ctx.signal, musicId: musicId || undefined, musicVolume: args.music_volume !== undefined ? Number(args.music_volume) : undefined, subtitles, format: args.format === 'webm' ? 'webm' : 'mp4' }); });
    useFiles.getState().openInPane(item.id);
    return { summary: `已把 ${clips.length} 段视频按顺序合成为「${item.name}」${subtitles.length ? `，含 ${subtitles.length} 条字幕` : ''}${musicId ? '，已配乐' : ''}`, actions: [{ id: 'open-media:' + item.id, label: '查看成片' }], artifact: { id: item.id, kind: 'video', name: item.name } };
  },
  // ---- 项目 ----
  async create_project(args) { const p = projects.create(String(args.title || '新项目')); return `已新建项目「${p.title}」，页面即将重新加载`; },
  async switch_project(args) { const p = projects.list().find(x => x.id === String(args.id || '')); if (!p) throw new Error(`找不到 id 为「${args.id}」的项目`); projects.switchTo(p.id); return `正在切换到项目「${p.title}」`; },
  async rename_project(args) { const p = projects.list().find(x => x.id === String(args.id || '')) || projects.active(); const title = String(args.title || '').trim(); if (!title) throw new Error('缺少新名称'); const old = p.title; projects.rename(p.id, title); return `已把项目「${old}」重命名为「${title}」`; },
};

// ===== 计划卡：把 actions 变成可读的步骤（标题 / 预览 / 图标类别 / 删除标记）=====
const PLAN_KIND: Record<string, string> = { write_doc: 'write', append_doc: 'write', replace_section: 'write', rename_doc: 'doc', delete_doc: 'delete', read_doc: 'doc', open_doc: 'doc', export_doc: 'export', open_media: 'media', rename_media: 'media', tag_media: 'media', delete_media: 'delete', generate_image: 'image', generate_video: 'video', compose_video: 'video', inspect_image: 'media', create_project: 'project', switch_project: 'project', rename_project: 'project', save_brief: 'brief', ask_user: 'brief', update_ledger: 'brief' };
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
    case 'inspect_image': return `用视觉模型看「${mediaName(g.id)}」${g.question ? '：' + String(g.question).slice(0, 30) : ''}`;
    case 'rename_media': return `把「${mediaName(g.id)}」重命名为「${g.name || ''}」`;
    case 'tag_media': return `把「${mediaName(g.id)}」归入「${g.group || '其他'}」分区`;
    case 'delete_media': return `删除「${mediaName(g.id)}」（进回收站，可撤销）`;
    case 'generate_image': return `生成图片「${String(g.name || g.prompt || '').slice(0, 20)}」` + (IMAGE_RATIOS.includes(g.ratio) ? `（${g.ratio}）` : '');
    case 'generate_video': { const from = g.from_media_id ? `以「${mediaName(g.from_media_id)}」为首帧` : (VIDEO_RATIOS.includes(g.ratio) ? String(g.ratio) : ''); const secs = String(g.duration || '').replace(/[^0-9]/g, ''); const parts = [from, secs ? `${secs} 秒` : '智能时长'].filter(Boolean); return `生成视频「${String(g.name || g.prompt || '').slice(0, 20)}」（${parts.join(' · ')}）`; }
    case 'save_brief': return '记录创作纲领';
    case 'ask_user': return '向你确认几个问题';
    case 'update_ledger': { const parts = []; if (g.stage) parts.push(`阶段推进到「${stageName(skillFor(String(g.skill || useFiles.getState().brief?.format || 'other')), g.stage)}」`); if (g.answers) parts.push('记录答案'); if (g.entities) parts.push('更新实体清单'); if (g.clips) parts.push('更新片段清单'); return `更新台账${parts.length ? '：' + parts.join('、') : ''}`; }
    case 'compose_video': { const n = Array.isArray(g.clip_ids) ? g.clip_ids.length : 0; const subs = Array.isArray(g.subtitles) ? g.subtitles.length : 0; return `把 ${n} 段视频按顺序合成 MP4 成片「${g.name || '成片'}」${subs ? `，${subs} 条字幕` : ''}${g.music_id ? '，配乐「' + mediaName(g.music_id) + '」' : ''}（本地合成，约需成片总时长的时间）`; }
    case 'create_project': return `新建空白项目「${g.title || '新项目'}」并切换过去（页面会重新加载）`;
    case 'switch_project': { const p = projects.list().find(x => x.id === String(g.id || '')); return `切换到项目「${p ? p.title : g.id}」（页面会重新加载）`; }
    case 'rename_project': { const p = projects.list().find(x => x.id === String(g.id || '')) || projects.active(); return `把项目「${p.title}」重命名为「${g.title || ''}」`; }
    default: return '执行 ' + (a?.tool || '未知操作');
  }
}

export function previewAction(a: Action): string {
  const g = a?.args || {};
  if (['generate_image', 'generate_video'].includes(a?.tool) && g.prompt) return String(g.prompt).slice(0, 400);
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
