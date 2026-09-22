// ===== 执行器：reply() 只产出计划；用户点「确认执行」后 executePlan() 才调用工具；工具写文稿时在右侧工作区逐行写入 =====
import type { Action, Artifact, FollowUp, Message, PlanStep, Review, ReviewItem } from '../types';
import { useAgent, useChats, useFiles, findDoc } from '../store';
import { modelCfg, callModel, chatCfg, partialPlanMessage, parsePlanJSON } from '../model';
import { AGENT_TOOLS, NO_CONFIRM_TOOLS, DESTRUCTIVE_TOOLS, GENERATE_TOOLS, planSteps, saveBrief } from './tools';
import { genMode } from '../mediagen';
import type { ToolContext, ToolResult } from './tools';
import { remotePlan, attachFollowUps, normalizeQuestions } from './planner';
import { briefText } from './prompt';
import { writingGuideText, lintScriptMarkdown } from '../guides';
import { docRole, splitLines } from '../markdown';
import { toast } from '../../components/Toast';
import { readLedger, ensureLedger, updateLedger } from '../ledger';
import { reviewImages, visionReady } from '../vision';
import { findMedia } from '../store';
import { skillFor, stageName } from '../skills';

const optionLabel = (o: unknown) => typeof o === 'string' ? o : String((o as any)?.label || '');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const agent = () => useAgent.getState();
const chats = () => useChats.getState();

interface PendingPlan { plan: Action[]; text: string; chatId: string; steps: PlanStep[]; }
const pendingPlans = new Map<string, PendingPlan>();
let logLines: string[] = [];
let pendingMessage: Message | null = null;
const lastToolContents: { title: string; content: string }[] = [];

function setLive(text: string) { agent().set({ live: text }); }
function glow(on: boolean) { agent().set({ glow: on }); if (!on) agent().set({ live: '' }); }
function commit() { chats().mutate(() => {}); }
function log(text: string | null, done = false) {
  if (done && logLines.length) logLines[logLines.length - 1] = logLines[logLines.length - 1].replace(/^◦/, '✓');
  if (text) logLines.push('◦ ' + text);
  const step = pendingMessage?.plan?.steps.find(s => s.status === 'running');
  if (step) { step.logs = step.logs || []; if (done && step.logs.length) step.logs[step.logs.length - 1] = step.logs[step.logs.length - 1].replace(/^◦/, '✓'); if (text) step.logs.push('◦ ' + text); }
  if (pendingMessage && !pendingMessage.plan) pendingMessage.text = 'Agent 正在操作…\n' + logLines.join('\n');
  commit();
}
export function stopAgent() { const a = agent(); a.set({ abortRequested: true }); a.controller?.abort(new DOMException('请求已停止', 'AbortError')); setLive('正在停止…'); }
const aborted = () => agent().abortRequested;

// 在工作区里逐行写入：先算出 from → to 的公共前后缀，只动画中间变化的部分
async function typeInto(docId: string, from: string, to: string) {
  const files = useFiles.getState(); files.openInPane(docId);
  let p = 0; while (p < from.length && p < to.length && from[p] === to[p]) p++;
  let s = 0; while (s < from.length - p && s < to.length - p && from[from.length - 1 - s] === to[to.length - 1 - s]) s++;
  const prefix = to.slice(0, p), suffix = to.slice(to.length - s), middle = to.slice(p, to.length - s);
  const lines = splitLines(middle); const total = lines.length;
  let typed = '';
  for (let i = 0; i < total; i++) {
    if (aborted()) break;
    typed += (i ? '\n' : '') + lines[i];
    agent().set({ writing: { docId, text: prefix + typed + suffix } });
    setLive(`写入第 ${i + 1}/${total} 行`);
    await sleep(Math.max(35, Math.min(150, 30 + lines[i].length * 1.6)));
  }
  agent().set({ writing: null });
  files.updateDoc(docId, { content: aborted() ? prefix + typed + suffix : to, by: 'agent' });
}

async function step(label: string, fn?: () => Promise<void> | void) {
  if (aborted()) throw new Error('已停止');
  setLive(label); log(label);
  if (fn) await fn();
  log(null, true); await sleep(200);
}

// steps（可选）：计划卡的步骤数组，与 actions 一一对应；逐步标记 running → done / failed / skipped
export async function runActions(actions: Action[], request: string, chatId: string, steps?: PlanStep[], messageAt?: number) {
  const results: string[] = []; const buttons: { id: string; label: string }[] = []; const reviewTargets: { docId: string; title: string }[] = []; const artifacts: Artifact[] = [];
  const mark = (i: number, status: PlanStep['status'], result?: string) => { const s = steps?.[i]; if (!s) return; s.status = status; if (result !== undefined) s.result = String(result || ''); commit(); };
  const skipRest = (from: number) => { for (let j = from; j < actions.length; j++) mark(j, 'skipped'); };
  const ctx: ToolContext = { request, chatId, typeInto, step, live: setLive, signal: agent().controller?.signal, messageAt };
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]; const fn = AGENT_TOOLS[a.tool]; if (!fn) { mark(i, 'skipped', '未知操作'); continue; }
    ctx.stepIndex = i;
    if (aborted()) { results.push('已按你的要求停止，后面的步骤没有执行'); skipRest(i); break; }
    mark(i, 'running');
    try {
      const r = await fn(a.args || {}, ctx);
      if (typeof r === 'string') { results.push(r); mark(i, 'done', r); }
      else if (r) { const rr = r as ToolResult; results.push(rr.summary); mark(i, 'done', rr.summary); if (rr.review) reviewTargets.push(rr.review); if (rr.artifact && !artifacts.some(x => x.id === rr.artifact!.id)) artifacts.push(rr.artifact); if (rr.content !== undefined) lastToolContents.push({ title: findDoc(String(a.args?.id || ''))?.name || findMedia(String(a.args?.id || ''))?.name || String(a.args?.id || ''), content: rr.content }); (rr.actions || []).forEach(b => { if (!buttons.some(x => x.id === b.id)) buttons.push(b); }); }
      else mark(i, 'done');
    } catch (e: any) {
      const stopped = e?.message === '已停止' || e?.name === 'AbortError';
      results.push(stopped ? '已按你的要求停止，后面的步骤没有执行' : `执行 ${a.tool} 时出错：${e?.message || e}`);
      mark(i, stopped ? 'skipped' : 'failed', stopped ? '' : String(e?.message || e));
      if (stopped) { skipRest(i + 1); break; }
    }
  }
  return { results, buttons, reviewTargets, artifacts };
}

function begin(pending: Message) {
  logLines = []; pendingMessage = pending;
  const controller = new AbortController();
  agent().set({ busy: true, abortRequested: false, controller });
  return controller;
}
function end() { agent().set({ busy: false, controller: null, writing: null }); glow(false); pendingMessage = null; }

export async function send(text: string, { quote = null as { text: string; source?: string } | null, attachments = [] as string[], fromSuggestion = false, display = undefined as string | undefined } = {}) {
  const t = text.trim(); if (!t && !quote) return;
  if (agent().busy) { toast('上一条指令还在执行，等它完成或点「停止」'); return; }
  const c = chats().chat();
  chats().push(c.id, { role: 'user', text: t || '请看这段文字', display, quote, attachments: attachments.length ? attachments : undefined, at: Date.now() });
  agent().set({ busy: true });
  await sleep(200);
  await reply(t, c.id, fromSuggestion);
}

export async function reply(text: string, chatId: string, fromSuggestion = false) {
  const c = chats().chats.find(x => x.id === chatId) || chats().chat();
  const last = c.messages[c.messages.length - 1]; const t = text + (last?.quote ? '\n' + last.quote.text : '');
  const pending: Message = { role: 'system', text: 'Agent 正在思考…', at: Date.now() };
  chats().mutate(all => { all.find(x => x.id === c.id)!.messages.push(pending); });
  const controller = begin(pending);
  const out: Message = { role: 'assistant', text: '', at: Date.now() };
  let streamedThinking = ''; let autoKey: string | null = null;   // 自动模式：纯生成计划不用确认，回复落地后直接执行
  const hooks = {
    signal: controller.signal,
    onStatus: (status: string) => { pending.streaming = false; pending.text = status; commit(); },
    onText: (content: string) => { const partial = partialPlanMessage(content); if (!partial && pending.role !== 'assistant') return; pending.role = 'assistant'; pending.streaming = true; pending.text = partial; commit(); },
    onReasoning: (reasoning: string) => { streamedThinking = reasoning; pending.role = 'assistant'; pending.streaming = true; pending.thinking = reasoning; if (!pending.text || pending.text === 'Agent 正在思考…') pending.text = ''; commit(); },
  };
  try {
    let plan: Action[] | null = null, message = '';
    lastToolContents.length = 0;
    try { const remote = await remotePlan(t, c, hooks); if (remote) { plan = remote.actions; message = remote.message; out.followUps = remote.followUps; } }
    catch (e: any) { plan = []; message = e?.name === 'AbortError' ? '已停止，本次没有修改任何文件。' : e?.code === 'MODEL_PLAN_FORMAT' ? e.message : `模型请求失败：${String(e?.message || e).replace(/[。.]\s*$/, '')}。未执行任何文件操作。`; }
    if (streamedThinking) out.thinking = streamedThinking;
    if (!plan) { plan = []; message = fromSuggestion ? '请先在模型设置中连接真实模型，再继续这个问题。未修改任何文件。' : ''; }
    // 纲领信息一旦出现就立即记录；台账更新（阶段推进 / 答案）免确认；纲领里有类型就加载对应的创作流程并建台账
    const notes: string[] = [];
    const briefSave = plan.find(a => a.tool === 'save_brief'); if (briefSave) { try { const saved = saveBrief(briefSave.args || {}); if (saved.length) notes.push(`✓ 已记录创作纲领：${saved.join('、')}`); } catch { /* ignore */ } plan = plan.filter(a => a.tool !== 'save_brief'); }
    const fmt = useFiles.getState().brief?.format;
    if (fmt) { try { const { created, ledger } = ensureLedger(fmt); if (created) notes.push(`✓ 已加载创作流程「${skillFor(ledger.skill).name}」，台账已建立`); } catch { /* ignore */ } }
    for (const a of plan.filter(x => x.tool === 'update_ledger')) { try { const r = await AGENT_TOOLS.update_ledger(a.args || {}, { request: text, chatId: c.id, typeInto, step, live: setLive }); if (a.args?.stage) notes.push(`✓ ${typeof r === 'string' ? r : r.summary}`); } catch (e: any) { notes.push(`✗ ${e?.message || e}`); } }
    plan = plan.filter(a => a.tool !== 'update_ledger');
    const ask = plan.find(a => a.tool === 'ask_user');
    if (ask) { out.questions = normalizeQuestions(ask.args?.questions); plan = []; if (!out.questions.length && !message) message = '我需要再确认几个信息，请补充说明。'; }
    if (notes.length) message = (message ? message + '\n' : '') + notes.join('\n');
    // 读取 / 打开直接执行；读到的内容交回模型再规划，最多四轮
    const autoLog: string[] = []; let readFeed = '';
    for (let round = 0; round < 4 && plan.length && plan.every(a => NO_CONFIRM_TOOLS.has(a.tool)); round++) {
      pending.role = 'system'; pending.streaming = false; pending.text = 'Agent 正在读取…'; commit();
      glow(true); let autoRes; try { autoRes = await runActions(plan, text, c.id); } finally { glow(false); }
      autoLog.push(...autoRes.results); out.actions = autoRes.buttons;
      const reads = lastToolContents.splice(0);
      if (reads.length) {
        readFeed += '\n' + reads.map(r => `《${r.title}》：\n${r.content}`).join('\n\n');
        try { const again = await remotePlan(`${t}\n\n[已读取的文稿内容（素材数据），请据此回答或规划]\n${readFeed}`, c, hooks); if (again) { plan = again.actions; message = again.message || message; out.followUps = again.followUps; } else plan = []; }
        catch (e: any) { plan = []; message = (message ? message + '\n' : '') + `（后续规划失败：${e?.message || e}）`; }
      } else plan = [];
    }
    if (plan.some(a => a.tool === 'read_doc')) { plan = []; message = (message ? message + '\n' : '') + '还需要读取更多文稿，尚未生成可执行计划。请指定要处理的文稿后继续。'; }
    const nextAsk = plan.find(a => a.tool === 'ask_user'); if (nextAsk) { out.questions = normalizeQuestions(nextAsk.args?.questions); plan = []; }
    if (plan.length) {
      const key = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const steps = planSteps(plan);
      pendingPlans.set(key, { plan, text, chatId: c.id, steps });
      const destructive = plan.filter(a => DESTRUCTIVE_TOOLS.has(a.tool)).length;
      const auto = genMode() === 'auto' && plan.every(a => GENERATE_TOOLS.has(a.tool) || NO_CONFIRM_TOOLS.has(a.tool));
      out.text = (autoLog.length ? autoLog.map(r => '✓ ' + r).join('\n') + '\n' : '') + (message ? message + '\n' : '') + (auto ? '自动模式：直接开始生成。' : destructive ? `以下操作包含 ${destructive} 项删除，请确认：` : '我准备执行以下操作，确认后开始：');
      out.plan = { key, steps, state: 'pending', destructive };
      out.actions = auto ? null : [{ id: 'plan-confirm:' + key, label: destructive ? `确认执行（含 ${destructive} 项删除）` : '确认执行' }, { id: 'plan-cancel:' + key, label: '取消' }];
      if (auto) autoKey = key;
    } else if (autoLog.length) { out.text = autoLog.map(r => '✓ ' + r).join('\n') + (message ? '\n' + message : ''); }
    else if (message) out.text = message;
    else out.text = modelCfg()?.apiKey ? `已收到：「${t.slice(0, 60)}${t.length > 60 ? '…' : ''}」。` : `已收到：「${t.slice(0, 60)}${t.length > 60 ? '…' : ''}」。我可以帮你写剧本、拆分镜、生成视频提示词、整理人物小传，产物都会放进右侧工作区。请先在设置里连接模型，我才能开始创作。`;
  } catch (e: any) { out.text = '执行时出错：' + (e?.message || e); }
  end();
  if (logLines.length) out.text = logLines.join('\n') + '\n\n' + out.text;
  chats().mutate(all => { const cc = all.find(x => x.id === c.id)!; const i = cc.messages.indexOf(pending); if (i >= 0) cc.messages.splice(i, 1); attachFollowUps(out, text, c.id); cc.messages.push(out); cc.at = Date.now(); });
  if (autoKey) void executePlan(autoKey, out.at);
}

export function cancelPlan(key: string, messageAt: number) {
  pendingPlans.delete(key);
  chats().mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === messageAt && m.plan?.key === key) { m.actions = null; m.plan.state = 'cancelled'; } });
}

export async function executePlan(key: string, messageAt: number) {
  const p = pendingPlans.get(key); if (!p) { toast('计划已失效，请重新发送请求后确认。'); return; }
  if (agent().busy) { toast('请等待当前任务完成。'); return; }
  pendingPlans.delete(key);
  chats().mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === messageAt && m.plan?.key === key) { m.actions = null; m.plan.state = 'confirmed'; } });
  const c = chats().chats.find(x => x.id === p.chatId) || chats().chat();
  const steps: PlanStep[] = p.steps.map(s => ({ ...s, status: 'pending', result: '', logs: [] }));
  const pending: Message = { role: 'assistant', text: '', plan: { steps, state: 'running' }, at: Date.now() };
  chats().mutate(all => { all.find(x => x.id === c.id)!.messages.push(pending); });
  begin(pending); glow(true);
  const out: Message = { role: 'assistant', text: '', at: Date.now() }; let results: string[] = [];
  try {
    await sleep(250);
    const run = await runActions(p.plan, p.text, c.id, steps, pending.at); results = run.results; out.actions = run.buttons; out.artifacts = run.artifacts;
    if (run.reviewTargets.length && modelCfg()?.apiKey && !aborted()) { pending.plan!.state = 'reviewing'; setLive('正在自审刚写的内容…'); commit(); try { out.review = await selfReview(run.reviewTargets.slice(0, 2)); } catch (e) { console.warn('自审失败', e); } }
    // 参考图质检：有支持看图的模型就逐张检查刚生成的图片
    const images = run.artifacts.filter(a => a.kind === 'image');
    if (images.length && visionReady() && !aborted()) { pending.plan!.state = 'reviewing'; setLive('正在用视觉模型检查参考图…'); commit(); try { out.imageReview = await reviewImages(images.slice(0, 6).map(a => ({ id: a.id, name: a.name, expect: a.prompt || '' })), agent().controller?.signal); } catch (e) { console.warn('参考图质检失败', e); } }
  } catch (e: any) { out.text = '执行时出错：' + (e?.message || e); }
  end();
  steps.forEach(s => { if (s.status === 'running') s.status = 'failed'; else if (s.status === 'pending') s.status = 'skipped'; });
  out.plan = { steps, state: steps.some(s => s.status === 'failed') ? 'error' : steps.some(s => s.status === 'skipped') ? 'stopped' : 'done' };
  if (logLines.length) out.log = logLines.slice();
  // 执行后的下一步：出错给「再试一次」；生成了参考图请用户确认；生成了多段视频建议合成
  const extra: FollowUp[] = []; const arts = out.artifacts || [];
  if (steps.some(s => s.status === 'failed')) extra.push({ label: '再试一次', prompt: '上一次执行有步骤出错，请只重新执行出错的那几步，已完成的不要重复。' });
  const images = arts.filter(a => a.kind === 'image').length, videos = arts.filter(a => a.kind === 'video' && !/\.webm$/i.test(a.name)).length;
  const bad = (out.imageReview || []).filter(r => r.verdict === '需重生成');
  if (bad.length) extra.push({ label: `重新生成 ${bad.length} 张不合格的参考图`, prompt: `视觉质检认为这些参考图需要重新生成：${bad.map(b => `「${b.name}」（${b.issues.join('；') || b.description}）`).join('、')}。请针对这些问题改写提示词，只重新生成这几张，先给方案。` });
  if (images) extra.push({ label: bad.length ? '其余参考图通过，继续下一步' : '参考图通过，继续下一步', prompt: '刚生成的参考图都可以用。把它们记进台账的实体清单（状态已确认），然后推进到下一阶段，先给方案。' }, { label: '重新生成某张参考图', prompt: '有一张参考图不满意，我会说明是哪张、要怎么改，然后只重新生成那一张。' });
  if (videos >= 2) extra.push({ label: '按顺序合成成片', prompt: `把刚生成的 ${videos} 段视频按分镜顺序用 compose_video 合成一条成片，先给方案。` });
  out.followUps = extra;
  chats().mutate(all => { const cc = all.find(x => x.id === c.id)!; const i = cc.messages.indexOf(pending); if (i >= 0) cc.messages.splice(i, 1); attachFollowUps(out, p.text + '\n' + results.join('\n'), c.id); cc.messages.push(out); cc.at = Date.now(); });
}

// 写完自审：用写作模型按当前类型的自查清单审读刚写的剧本文稿
async function selfReview(targets: { docId: string; title: string }[]): Promise<Review | null> {
  const cfg = modelCfg(); if (!cfg?.apiKey) return null; const wcfg = chatCfg(cfg, 'write');
  const items: ReviewItem[] = [];
  for (const tgt of targets) {
    const doc = findDoc(tgt.docId); if (!doc || docRole(doc.name) !== 'script') continue;
    const text = doc.content.slice(-6000);
    const lint = lintScriptMarkdown(text).slice(0, 6).map(x => `第 ${x.line} 行：${x.message}（${x.snippet}）`).join('\n');
    const sys = `你是严格但务实的剧本编辑。按下面的规范和自查清单审读这份剧本（Markdown），只输出 JSON：{"verdict":"通过|需修改","score":1到10的整数,"praise":"一句话说最大的优点","issues":[{"point":"问题（不超过 40 字）","fix":"具体修改建议（不超过 60 字）"}]}。问题最多 4 条，只列真正影响可拍性、逻辑、人物一致性或节奏的问题；没有明显问题就 verdict 通过、issues 为空。\n${briefText()}\n${writingGuideText(useFiles.getState().brief?.format)}${lint ? `\n【格式检查发现】\n${lint}` : ''}`;
    const content = await callModel(wcfg, sys, `《${doc.name}》${doc.content.length > 6000 ? '（末尾部分）' : ''}：\n${text}`);
    const parsed = parsePlanJSON(content);
    items.push({ docId: doc.id, title: doc.name, verdict: parsed.verdict === '通过' ? '通过' : '需修改', score: Math.max(1, Math.min(10, parseInt(parsed.score, 10) || 0)) || null, praise: String(parsed.praise || '').slice(0, 120), issues: (Array.isArray(parsed.issues) ? parsed.issues : []).slice(0, 4).map((x: any) => ({ point: String(x?.point || '').slice(0, 80), fix: String(x?.fix || '').slice(0, 120) })).filter((x: any) => x.point) });
  }
  return items.length ? { items, at: Date.now() } : null;
}

// 追问卡片：提交答案（气泡显示「我已确认以上信息」，完整答案交给模型并记进台账）/ 由 Agent 决定
export function answerQuestions(messageAt: number, decide: boolean) {
  const c = chats().chat(); const m = c.messages.find(x => x.at === messageAt && x.questions); if (!m || !m.questions) return;
  const answers = m.answers || {}, texts = m.textAnswers || {};
  const lines: string[] = []; const record: Record<string, string> = {}; let answered = 0;
  m.questions.forEach((q, qi) => {
    const picks = (answers[qi] || []).map(oi => optionLabel(q.options[oi])).filter(Boolean); const free = String(texts[qi] || '').trim();
    const value = [...picks, free].filter(Boolean).join('、');
    if (value) { answered++; lines.push(`${q.text}：${value}`); if (q.key) record[q.key] = value; } else lines.push(`${q.text}：（未回答，由你决定）`);
  });
  const text = decide ? '这些问题由你来定，按专业判断处理，之后不必再问。' : answered ? '我已确认以上信息：\n' + lines.join('\n') : ''; if (!text) return;
  if (!decide && Object.keys(record).length) { try { const fmt = useFiles.getState().brief?.format; if (readLedger() || fmt) { if (!readLedger()) ensureLedger(fmt); updateLedger({ answers: record }); } } catch { /* ignore */ } }
  chats().mutate(all => { for (const cc of all) for (const mm of cc.messages) if (mm.at === messageAt) mm.questionsUsed = true; });
  void send(text, { display: decide ? undefined : '我已确认以上信息' });
}
export function setTextAnswer(messageAt: number, qi: number, text: string) {
  chats().mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === messageAt && m.questions) { m.textAnswers = { ...(m.textAnswers || {}), [qi]: text }; } });
}
export function toggleAnswer(messageAt: number, qi: number, oi: number) {
  chats().mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === messageAt && m.questions) { const q = m.questions[qi]; if (!q) return; m.answers = m.answers || {}; const cur = m.answers[qi] || []; m.answers[qi] = q.multi ? (cur.includes(oi) ? cur.filter(x => x !== oi) : [...cur, oi]) : (cur.includes(oi) ? [] : [oi]); } });
}
export function useFollowUp(messageAt: number, index: number) {
  const c = chats().chat(); const m = c.messages.find(x => x.at === messageAt); const option = m?.followUps?.[index]; if (!m || !option) return;
  chats().mutate(all => { for (const cc of all) for (const mm of cc.messages) if (mm.at === messageAt) mm.followUpUsed = option.label; });
  void send(option.prompt, { fromSuggestion: true });
}
export function reviewFix(messageAt: number, index: number) {
  const c = chats().chat(); const m = c.messages.find(x => x.at === messageAt); const it = m?.review?.items?.[index]; if (!it) return;
  const text = `按自审建议修改《${it.title}》：\n${it.issues.map((x, i) => `${i + 1}. ${x.point}${x.fix ? '：' + x.fix : ''}`).join('\n')}\n只改有问题的段落（用 replace_section），其他内容保持不变。`;
  void send(text);
}
export function restoreTrash(trashId: string, messageAt: number) {
  const entry = useFiles.getState().restoreTrash(trashId);
  if (!entry) { toast('回收站里没有这份文件'); return; }
  const name = entry.doc?.name || entry.media?.name || '';
  chats().mutate(all => { for (const c of all) for (const m of c.messages) if (m.at === messageAt) { m.actions = (m.actions || []).filter(x => x.id !== 'restore-trash:' + trashId); m.text += `\n已恢复「${name}」`; } });
  useFiles.getState().openInPane(entry.doc?.id || entry.media?.id || null);
}
