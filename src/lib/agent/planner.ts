// ===== 规划器：把用户请求交给模型，得到 {message, actions, followUps}；追问与下一步建议的规整 =====
import type { Action, Chat, FollowUp, Message, Question } from '../types';
import { modelCfg, callModel, isCreativeRequest, chatCfg, parsePlanJSON, parsePlanJSONLoose } from '../model';
import { AGENT_TOOLS } from './tools';
import { buildSystemPrompt, hasScriptDoc } from './prompt';
import { readLedger } from '../ledger';
import type { ChatKind } from '../model';
import { nextStep } from '../director';

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
    const label = item.label.trim(), prompt = item.prompt.trim();
    if (!label || label.length > 24 || !prompt || prompt.length > 400 || /[\r\n]/.test(label)) continue;
    const key = prompt.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key) || labels.has(label)) continue;
    seen.add(key); labels.add(label); result.push({ label, prompt }); if (result.length === 3) break;
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
export function attachFollowUps(message: Message, request: string, chatId: string) {
  message.followUpContext = { chatId };
  const options = normalizeFollowUps(message.followUps);
  // 导演算出的标准下一步永远排第一，用户不用猜下一步点什么
  try { const step = nextStep(); if (step.kind === 'agent' && step.prompt && !options.some(o => o.prompt === step.prompt)) options.unshift({ label: step.label.slice(0, 24), prompt: step.prompt }); } catch { /* ignore */ }
  for (const option of fallbackFollowUps(request + '\n' + message.text)) {
    if (options.length === 3) break;
    if (!options.some(x => x.label === option.label || x.prompt === option.prompt)) options.push(option);
  }
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

// 严格模式：结构不对就抛错（触发一次带修正提示的重试）；宽松模式（重试那次）：修复截断、丢掉无效操作、归一常见走形，尽量把能用的部分交出来
export function parseAgentPlan(content: string, { lenient = false }: { lenient?: boolean } = {}): PlanReply {
  const { data: parsed, repaired } = lenient ? parsePlanJSONLoose(content) : { data: parsePlanJSON(content), repaired: false };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模型回复不是 JSON 对象');
  // 常见走形：message 写成对象或叫 text / reply；actions 叫 plan / steps；顶层直接是一个操作；顶层直接给 questions
  const message: string = typeof parsed.message === 'string' ? parsed.message : typeof parsed.message?.text === 'string' ? parsed.message.text : typeof parsed.text === 'string' ? parsed.text : typeof parsed.reply === 'string' ? parsed.reply : '';
  let raw: unknown = parsed.actions;
  if (!Array.isArray(raw)) raw = Array.isArray(parsed.plan) ? parsed.plan : Array.isArray(parsed.steps) ? parsed.steps : typeof parsed.tool === 'string' ? [parsed] : Array.isArray(parsed.questions) ? [{ tool: 'ask_user', args: { questions: parsed.questions } }] : undefined;
  if (!Array.isArray(raw) || (!message && !raw.length) || raw.length > 100) throw new Error('模型回复缺少有效的 message / actions');
  const actions: { tool: string; args: Record<string, any> }[] = []; const dropped: string[] = [];
  for (const action of raw as any[]) {
    const ok = !!action && typeof action === 'object' && typeof action.tool === 'string' && Object.hasOwn(AGENT_TOOLS, action.tool) && !!action.args && typeof action.args === 'object' && !Array.isArray(action.args);
    if (ok) actions.push({ tool: action.tool, args: action.args });
    else if (lenient) dropped.push(String(action?.tool || '?').slice(0, 24));
    else throw new Error('模型回复包含无效的操作结构');
  }
  if (repaired && actions.length) actions.pop();   // 截断修复后最后一个操作多半不完整，宁可丢掉也不执行半截
  const notes = [repaired ? '回复在末尾被截断，最后一步已丢弃' : '', dropped.length ? `忽略了 ${dropped.length} 个无效操作（${dropped.slice(0, 3).join('、')}）` : ''].filter(Boolean);
  return { message: notes.length ? `${message}${message ? '\n' : ''}（${notes.join('；')}）` : message, actions, followUps: normalizeFollowUps(parsed.followUps) };
}

async function requestAgentPlan(request: (retry: boolean) => Promise<string>): Promise<PlanReply> {
  let lastError: any = null, lastContent = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await request(attempt > 0);   // 网络中断或不完整响应不能当作格式错误继续执行
    try { return parseAgentPlan(content, { lenient: attempt > 0 }); } catch (e: any) {
      lastError = e; lastContent = String(content || '');
      console.warn(`[moodio] 第 ${attempt + 1} 次规划回复无法解析：${e?.message || e}`, lastContent.slice(0, 3000));
      try { (window as any).__moodioLastPlanError = { attempt: attempt + 1, error: String(e?.message || e), content: lastContent }; } catch { /* ignore */ }   // 排查用：控制台里能拿到原样字节
    }
  }
  const head = lastContent.trim().replace(/\s+/g, ' ').slice(0, 240);
  const error: any = new Error(`模型回复格式不正确（${lastError?.message || '无法解析'}），自动重试后仍未得到有效操作计划。未执行任何文件操作，请重试。${head ? `\n\n模型原始回复开头：${head}${lastContent.trim().length > 240 ? '…' : ''}` : '\n\n模型返回了空内容。'}`);
  error.code = 'MODEL_PLAN_FORMAT'; error.raw = lastContent; throw error;
}

export async function remotePlan(text: string, chat: Chat, hooks: PlanHooks = {}): Promise<PlanReply | null> {
  const cfg = modelCfg(); if (!cfg?.apiKey) return null;
  const sys = buildSystemPrompt(text, chat);
  const callCfg = chatCfg(cfg, kindForRequest(text));
  return requestAgentPlan(async retry => {
    const repair = retry ? '\n上次回复未通过 JSON / actions 结构校验。请依据同一用户请求重新输出完整 JSON 对象，包含字符串 message 和数组 actions。字符串中的换行与引号必须正确转义，不要代码围栏、前后说明或截断内容。不要增加原请求以外的操作。' : '';
    if (retry) hooks.onStatus?.('正在修正模型回复格式…');
    return callModel(callCfg, sys + repair, text, { signal: hooks.signal, onText: hooks.onText, onReasoning: hooks.onReasoning });
  });
}
