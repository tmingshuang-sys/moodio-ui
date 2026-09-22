// ===== 规划器：把用户请求交给模型，得到 {message, actions, followUps}；追问与下一步建议的规整 =====
import type { Action, Chat, FollowUp, Message, Question } from '../types';
import { modelCfg, callModel, isCreativeRequest, writerCfg, parsePlanJSON } from '../model';
import { AGENT_TOOLS } from './tools';
import { buildSystemPrompt, hasScriptDoc } from './prompt';

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

export function parseAgentPlan(content: string): PlanReply {
  const parsed = parsePlanJSON(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof parsed.message !== 'string' || !Array.isArray(parsed.actions) || parsed.actions.length > 100) throw new Error('模型回复缺少有效的 message / actions');
  for (const action of parsed.actions) {
    if (!action || typeof action !== 'object' || !Object.hasOwn(AGENT_TOOLS, action.tool) || !action.args || typeof action.args !== 'object' || Array.isArray(action.args)) throw new Error('模型回复包含无效的操作结构');
  }
  return { message: parsed.message, actions: parsed.actions.map((a: any) => ({ tool: a.tool, args: a.args })), followUps: normalizeFollowUps(parsed.followUps) };
}

async function requestAgentPlan(request: (retry: boolean) => Promise<string>): Promise<PlanReply> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await request(attempt > 0);   // 网络中断或不完整响应不能当作格式错误继续执行
    try { return parseAgentPlan(content); } catch (e) {
      if (attempt) { const error: any = new Error('模型回复格式不正确，自动重试后仍未得到有效操作计划。未执行任何文件操作，请重试。'); error.code = 'MODEL_PLAN_FORMAT'; throw error; }
    }
  }
  throw new Error('unreachable');
}

export async function remotePlan(text: string, chat: Chat, hooks: PlanHooks = {}): Promise<PlanReply | null> {
  const cfg = modelCfg(); if (!cfg?.apiKey) return null;
  const sys = buildSystemPrompt(text, chat);
  const callCfg = isCreativeRequest(text) ? writerCfg(cfg) : cfg;
  return requestAgentPlan(async retry => {
    const repair = retry ? '\n上次回复未通过 JSON / actions 结构校验。请依据同一用户请求重新输出完整 JSON 对象，包含字符串 message 和数组 actions。字符串中的换行与引号必须正确转义，不要代码围栏、前后说明或截断内容。不要增加原请求以外的操作。' : '';
    if (retry) hooks.onStatus?.('正在修正模型回复格式…');
    return callModel(callCfg, sys + repair, text, { signal: hooks.signal, onText: hooks.onText, onReasoning: hooks.onReasoning });
  });
}
