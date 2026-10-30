// ===== 规划器：把用户请求交给模型，得到 {message, actions, followUps}；追问与下一步建议的规整 =====
import type { Action, Chat, FollowUp, Message, Question } from '../types';
import { modelCfg, callModel, isCreativeRequest, chatCfg, parsePlanJSON, parsePlanJSONLoose, salvagePlanParts } from '../model';
import { AGENT_TOOLS } from './tools';
import { buildSystemPrompt, hasScriptDoc } from './prompt';
import { readLedger } from '../ledger';
import { STAGE_ORDER } from '../skills';
import type { StageId } from '../skills';
import type { ChatKind } from '../model';
import { nextStep } from '../director';
import { useAgent } from '../store';
import { recordRound } from '../timing';

// 请求用哪类模型：分镜 / 片段提示词 / 台账阶段在片段方案时走「编译」（强模型、低温度），其他创意请求走写作，剩下走规划
export function kindForRequest(text: string): ChatKind {
  const stage = readLedger()?.stage;
  if (stage === 'prompts' || stage === 'storyboard' || /提示词|prompt|分镜|片段方案|校验/i.test(text)) return 'compile';
  return isCreativeRequest(text) ? 'write' : 'plan';
}

export interface PlanReply { message: string; actions: Action[]; followUps: FollowUp[]; }
export interface PlanHooks { onStatus?: (s: string) => void; onText?: (t: string) => void; onReasoning?: (t: string) => void; signal?: AbortSignal; }

// 模型建议只接受短标签和用户可见的请求文本，不接受命令、工具名或可执行代码
export function normalizeFollowUps(value: unknown): FollowUp[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>(), labels = new Set<string>(), result: FollowUp[] = [];
  for (const item of value.slice(0, 12)) {
    if (!item || typeof item.label !== 'string' || typeof item.prompt !== 'string') continue;
    if (item.action && item.action !== 'nle') continue;
    const label = item.label.trim(), prompt = item.prompt.trim();
    if (!label || label.length > 24 || !prompt || prompt.length > 400 || /[\r\n]/.test(label)) continue;
    const key = prompt.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key) || labels.has(label)) continue;
    seen.add(key); labels.add(label); result.push(item.action === 'nle' ? { label, prompt, action: 'nle' as const } : { label, prompt }); if (result.length === 3) break;
  }
  return result;
}
export function fallbackFollowUps(text: string): FollowUp[] {
  if (/人物|角色|动机|关系/.test(text)) return [
    { label: '深入分析人物动机', prompt: '请结合刚才的回答，进一步分析人物的目标、阻碍和行为动机。只给分析建议，不修改文件。' },
    { label: '梳理人物关系', prompt: '请结合刚才的回答，梳理主要人物的关系、冲突和可发展的方向。只给建议，不创建文件。' },
    { label: '更新人物小传', prompt: '请根据刚才的人物分析，把新的设定补进人物小传，先给方案让我确认。' }];
  if (hasScriptDoc()) return [
    { label: '检查剧情逻辑', prompt: '请结合刚才的回答和当前剧本，检查因果关系、人物动机与节奏，列出最值得调整的三点。只给建议，不修改文件。' },
    { label: '为剧本拆分镜', prompt: '请根据当前剧本拆分镜，写成分镜表，先给方案让我确认。' },
    { label: '生成视频提示词', prompt: '请根据分镜表为每个镜头生成视频生成提示词，先告诉我打算生成哪几个镜头。' }];
  return [
    { label: '构思故事方向', prompt: '请根据刚才的对话，给我三个故事方向，比较各自的核心冲突，先不要创建文件。' },
    { label: '设计主要人物', prompt: '请根据刚才的对话，提出主要人物的目标、弱点和关系设定，先给方案让我确认。' },
    { label: '写一场开场戏', prompt: '请根据刚才的对话写开场戏，先给节拍方案让我确认。' }];
}
// 有创作流程（台账）时按当前阶段给兜底建议：只给「这一步还能做什么」，不给已经做完的阶段的动作（分镜写完了就不再建议「为剧本拆分镜」）
const STAGE_FALLBACKS: Record<StageId, FollowUp[]> = {
  brief: [
    { label: '先看几个故事方向', prompt: '先不写文件，给我 3 个不同方向的一句话故事概念，比较各自的核心冲突，我选一个再继续。' },
    { label: '你来定，直接往下走', prompt: '纲领里没答的都用推荐值，直接进入下一阶段。' }],
  model: [
    { label: '先看故事方向', prompt: '在建模文稿的基础上先给我 3 个故事方向（各一句话），我选一个再写脚本。' },
    { label: '补充一条我想强调的信息', prompt: '我想在建模文稿里补充一条信息：' }],
  script: [
    { label: '检查剧情逻辑', prompt: '请结合当前剧本检查因果关系、人物动机与节奏，列出最值得调整的三点。只给建议，不修改文件。' },
    { label: '换一个故事方向', prompt: '当前脚本的方向我不满意，先给我 3 个不同的故事方向（各一句话），我选一个你再重写。' },
    { label: '缩短或改时长', prompt: '请把脚本改成另一个总时长版本：' }],
  assets: [
    { label: '逐张检查参考图', prompt: '请逐张核对参考图是否符合冻结外形描述、五官锚点与画风基线（真人 / 卡通不能混），不符合的重新生成，并在台账里更新 ref。' },
    { label: '调整产品三视图', prompt: '请按商品模型重新核对产品三视图的结构、颜色与角度，不对的重新生成后再拼成一张。' },
    { label: '换一种视觉风格', prompt: '我想换一种视觉风格：' }],
  storyboard: [
    { label: '检查分镜节奏', prompt: '请对照脚本检查分镜表：镜头时长合计、景别与运镜的节奏、每个卖点 / 钩子是否落在具体镜头，列出要改的点。' },
    { label: '减少镜头数', prompt: '请按生成策略把分镜表改成更少、更长的镜头，保持总时长不变。' }],
  prompts: [
    { label: '逐段核对片段方案', prompt: '请对照分镜表与台账逐段核对片段提示词：时段首尾相接、参考图引用、冻结外形描述、卡点与承接，列出要改的点并直接修正。' },
    { label: '改成更少的段', prompt: '请把片段方案合并成更少、更长的片段（不超过当前视频模型的单段上限），重写对应的提示词文稿并更新台账。' },
    { label: '换一种镜头风格', prompt: '我想把片段的镜头语言改成：' }],
  video: [
    { label: '检查已生成的片段', prompt: '请逐段检查已生成的视频是否符合片段提示词（人物、产品、场景是否一致），不符合的告诉我哪一段、怎么改。' },
    { label: '重新生成某一段', prompt: '请重新生成第 ' }],
  // 科普流程的阶段
  source: [
    { label: '换一个课程来源', prompt: '我想换一个素材来源：' },
    { label: '我直接粘贴文稿', prompt: '我把课程内容直接贴给你，请据此建立「转写稿.md」：' }],
  knowledge: [
    { label: '只挑反常识的', prompt: '知识点清单里只保留反常识、能推翻观众既有印象的那些，其余标成不做，然后重排「选题排期.md」。' },
    { label: '再多挑几个', prompt: '再从转写稿里多挑几个值得单独做一条的知识点，补进知识点清单。' },
    { label: '先做这一条', prompt: '先只做编号 01 这一条，走完全流程看效果，其余的等我看完再说。' }],
  scene: [
    { label: '画面太单调了', prompt: '当前画面方案里模板太单一，请按内容换成 number / compare / steps / chart / quote，连着两段不要用同一个模板。' },
    { label: '加一个数据图', prompt: '这条片子里能用数据说话的地方，换成 chart 模板，数据从转写稿里取，取不到就不要编。' }],
  narrate: [
    { label: '换一个音色', prompt: '口播音色我不满意，请重新设计一个音色再配：' },
    { label: '不要人声，只上字幕', prompt: '这一轮不要配音，直接渲染带字幕的版本。' }],
  render: [
    { label: '换一套配色', prompt: '画面配色换成另一套风格模板（墨白 / 深夜 / 学院 / 纸感 / 高饱和），改画面方案的 theme 再重新渲染。' },
    { label: '节奏太慢了', prompt: '成片节奏偏慢，请把口播稿里可以合并的句子合并、能删的删，再重新配音渲染。' }],
  compose: [
    { label: '加一段配乐', prompt: '给成片加一段配乐：用媒体库里的音频，音量压在口播之下。' },
    { label: '这一条重渲染', prompt: '我想改这一条的画面：' }],
  deliver: [
    { label: '修改成片的某一段', prompt: '请修改成片的第 ' },
    { label: '写一份交付说明', prompt: '请为成片写一份交付说明：结构、每段承担的内容、核心信息如何落地，存成「交付说明.md」。' },
    // 点了直接把成片送进剪辑软件（本地动作，不发给模型）；交付环节任何类型的创作都该有这一个
    { label: '导入到剪辑软件', prompt: '把成片的片段按顺序导入剪辑软件，配乐与配音各占一条音轨。', action: 'nle' }],
};
export function stageFallbacks(stage: StageId): FollowUp[] { return STAGE_FALLBACKS[stage] || []; }
export function attachFollowUps(message: Message, request: string, chatId: string) {
  message.followUpContext = { chatId };
  const options = normalizeFollowUps(message.followUps);
  // 导演算出的标准下一步永远排第一，用户不用猜下一步点什么
  let stage: StageId | null = null;
  try { const step = nextStep(); if (step.kind !== 'start') stage = step.stage; if (step.kind === 'agent' && step.prompt && !options.some(o => o.prompt === step.prompt)) options.unshift({ label: step.label.slice(0, 24), prompt: step.prompt }); } catch { /* ignore */ }
  const ledger = readLedger(); const cur = stage || ledger?.stage || null;
  const fallbacks = cur && STAGE_ORDER.includes(cur) ? stageFallbacks(cur) : fallbackFollowUps(request + '\n' + message.text);
  for (const option of fallbacks) {
    if (options.length === 3) break;
    if (!options.some(x => x.label === option.label || x.prompt === option.prompt)) options.push(option);
  }
  // 交付阶段一定要有「导入到剪辑软件」：模型给的建议再多也给它留一个位置
  const nle = (cur === 'deliver' ? stageFallbacks('deliver') : []).find(o => o.action === 'nle');
  if (nle && !options.some(o => o.action === 'nle')) { if (options.length >= 3) options.pop(); options.push(nle); }
  message.followUps = options;
}
// 一批最多 8 题；选项可以是字符串或 {label, hint}；没有选项的题自动变成填空题
export function normalizeQuestions(list: unknown): Question[] {
  return (Array.isArray(list) ? list : []).slice(0, 8).map((q: any): Question => {
    const options = (Array.isArray(q?.options) ? q.options : []).map((o: any) => typeof o === 'string' ? { label: o.trim() } : { label: String(o?.label ?? o?.text ?? '').trim(), hint: o?.hint ? String(o.hint).trim().slice(0, 80) : undefined }).filter((o: any) => o.label).slice(0, 8);
    const type: Question['type'] = !options.length || q?.type === 'text' ? 'text' : (q?.type === 'multi' || q?.multi) ? 'multi' : 'single';
    return { text: String(q?.text || q?.question || '').trim().slice(0, 200), type, options: type === 'text' ? [] : options, multi: type === 'multi', placeholder: q?.placeholder ? String(q.placeholder).trim().slice(0, 80) : undefined, key: q?.key ? String(q.key).trim().slice(0, 40) : undefined };
  }).filter(q => q.text);
}

// 每个工具真正必须的参数：缺了就说明这个操作没写全（多半是回复被截断在半截），宁可丢掉也不要拿去执行
const REQUIRED_ARGS: Record<string, string[]> = {
  ask_user: ['questions'], read_doc: ['id'], open_doc: ['id'], open_media: ['id'], export_doc: ['id'], inspect_image: ['id'], make_sheet: ['tiles'],
  write_doc: ['name', 'content'], append_doc: ['id', 'content'], replace_section: ['id', 'heading', 'content'], rename_doc: ['id', 'name'], delete_doc: ['id'],
  rename_media: ['id', 'name'], tag_media: ['id'], delete_media: ['id'],
  generate_image: ['prompt'], generate_video: ['prompt'], generate_voice: ['description'], generate_speech: ['text'], compose_video: ['clip_ids'],
  switch_project: ['id'], rename_project: ['title'],
};
const filled = (v: unknown): boolean => Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? !!v.trim() : v !== undefined && v !== null && v !== '';
const wellFormed = (action: any): boolean =>
  !!action && typeof action === 'object' && typeof action.tool === 'string' && Object.hasOwn(AGENT_TOOLS, action.tool)
  && !!action.args && typeof action.args === 'object' && !Array.isArray(action.args)
  && (REQUIRED_ARGS[action.tool] || []).every(k => filled(action.args[k]));

// 严格模式：结构不对就抛错（触发一次带修正提示的重试）；宽松模式：修复截断、丢掉无效操作、归一常见走形，尽量把能用的部分交出来
// 两种模式都只丢坏掉的那一个操作，严格模式下只有「一个有效操作都不剩」才抛错去重问模型
export function parseAgentPlan(content: string, { lenient = false }: { lenient?: boolean } = {}): PlanReply {
  const { data: parsed, repaired, truncated } = lenient ? parsePlanJSONLoose(content) : { data: parsePlanJSON(content), repaired: false, truncated: false };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模型回复不是 JSON 对象');
  // 常见走形：message 写成对象或叫 text / reply；actions 叫 plan / steps；顶层直接是一个操作；顶层直接给 questions
  const message: string = typeof parsed.message === 'string' ? parsed.message : typeof parsed.message?.text === 'string' ? parsed.message.text : typeof parsed.text === 'string' ? parsed.text : typeof parsed.reply === 'string' ? parsed.reply : '';
  let raw: unknown = parsed.actions;
  if (!Array.isArray(raw)) raw = Array.isArray(parsed.plan) ? parsed.plan : Array.isArray(parsed.steps) ? parsed.steps : typeof parsed.tool === 'string' ? [parsed] : Array.isArray(parsed.questions) ? [{ tool: 'ask_user', args: { questions: parsed.questions } }] : undefined;
  if (!Array.isArray(raw) || (!message && !raw.length) || raw.length > 100) throw new Error('模型回复缺少有效的 message / actions');
  const actions: { tool: string; args: Record<string, any> }[] = []; const dropped: string[] = [];
  for (const action of raw as any[]) {
    if (wellFormed(action)) actions.push({ tool: action.tool, args: action.args });
    else dropped.push(String(action?.tool || '?').slice(0, 24));
  }
  if (dropped.length && !actions.length) throw new Error('模型回复包含无效的操作结构');   // 一个有效操作都没有：交给上层重问模型
  const cut = repaired && truncated && actions.length;
  if (cut) actions.pop();   // 真截断（断在字符串中间）时最后一个操作只写了一半，宁可丢掉也不执行半截
  const notes = [cut ? '回复在末尾被截断，最后一步已丢弃' : repaired ? '回复格式有误，已自动修复' : '', dropped.length ? `忽略了 ${dropped.length} 个无效操作（${dropped.slice(0, 3).join('、')}）` : ''].filter(Boolean);
  return { message: notes.length ? `${message}${message ? '\n' : ''}（${notes.join('；')}）` : message, actions, followUps: normalizeFollowUps(parsed.followUps) };
}

async function requestAgentPlan(request: (attempt: number) => Promise<string>): Promise<PlanReply> {
  let lastError: any = null, lastContent = '';
  // 本地抢救同一份回复：先按宽松模式修，修不回来就扫出 message 与每个 {"tool":…} 对象
  // needActions=true 时只有捞回动作才算数（前两轮还能重问模型），最后一轮连说明也要留下，不让整轮白跑
  const salvage = (content: string, needActions: boolean): PlanReply | null => {
    try { const r = parseAgentPlan(content, { lenient: true }); if (r.actions.length || !needActions) return r; } catch { /* 继续扫 */ }
    const parts = salvagePlanParts(content);
    const actions = parts.actions.filter(a => wellFormed(a)).map(a => ({ tool: a.tool as string, args: a.args as Record<string, any> }));
    const message = String(parts.message || '').trim();
    if (!actions.length && (needActions || !message)) return null;
    const dropped = parts.actions.length - actions.length;
    const note = `（模型这次的 JSON 写坏了，已从回复里救回${actions.length ? ` ${actions.length} 个操作` : '说明部分'}${dropped > 0 ? `，${dropped} 个写坏的操作已丢弃` : ''}${actions.length ? '' : '，没有执行任何操作'}）`;
    return { message: message ? `${message}\n${note}` : note, actions, followUps: [] };
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const content = await request(attempt);   // 网络中断或不完整响应不能当作格式错误继续执行
    try { return parseAgentPlan(content, { lenient: attempt > 0 }); } catch (e: any) {
      lastError = e; lastContent = String(content || '');
      console.warn(`[moodio] 第 ${attempt + 1} 次规划回复无法解析：${e?.message || e}`, lastContent.slice(0, 3000));
      try { (window as any).__moodioLastPlanError = { attempt: attempt + 1, error: String(e?.message || e), content: lastContent }; } catch { /* ignore */ }   // 排查用：控制台里能拿到原样字节
    }
    const rescued = salvage(content, attempt < 2);
    if (rescued) { console.warn(`[moodio] 第 ${attempt + 1} 次回复本地修复成功（${rescued.actions.length} 个操作），不再重问模型`); return rescued; }
  }
  const head = lastContent.trim().replace(/\s+/g, ' ').slice(0, 240);
  const error: any = new Error(`模型回复格式不正确（${lastError?.message || '无法解析'}），重试两次并尝试本地修复后仍然没有可用内容。未执行任何文件操作，请重试。${head ? `\n\n模型原始回复开头：${head}${lastContent.trim().length > 240 ? '…' : ''}` : '\n\n模型返回了空内容。'}`);
  error.code = 'MODEL_PLAN_FORMAT'; error.raw = lastContent; throw error;
}

export async function remotePlan(text: string, chat: Chat, hooks: PlanHooks = {}): Promise<PlanReply | null> {
  const cfg = modelCfg(); if (!cfg?.apiKey) return null;
  const sys = buildSystemPrompt(text, chat);
  const kind = kindForRequest(text);
  const callCfg = chatCfg(cfg, kind);
  // 打点：界面上的「已用 N 秒 · 通常 M 秒」靠它，耗时也回写成下次的预期
  const startedAt = Date.now();
  useAgent.getState().set({ round: { kind, startedAt } });
  const stop = () => { recordRound(kind, Date.now() - startedAt); useAgent.getState().set({ round: null }); };
  try {
    return await requestAgentPlan(async attempt => {
      const repair = attempt === 1
        ? '\n上次回复未通过 JSON / actions 结构校验。请依据同一用户请求重新输出完整 JSON 对象，包含字符串 message 和数组 actions。字符串中的换行与引号必须正确转义，不要代码围栏、前后说明或截断内容。不要增加原请求以外的操作。'
        : attempt >= 2
          ? '\n前两次回复都没能解析成 JSON。这一次把输出压到最简：只输出 {"message":"一两句话","actions":[…]}，不要 followUps、不要任何解释文字与代码围栏；message 不超过 80 字；actions 最多 3 个、只保留最关键的操作；所有字符串里的换行写成 \\n。'
          : '';
      if (attempt > 0) hooks.onStatus?.('正在修正模型回复格式…');
      return callModel(callCfg, sys + repair, text, { signal: hooks.signal, onText: hooks.onText, onReasoning: hooks.onReasoning });
    });
  } finally { stop(); }
}
