// ===== 导演：由代码决定「现在处于哪一步、下一步做什么」，模型只负责填内容 =====
// nextStep() 是纯函数：读纲领 / 台账 / 工作区 / 校验，给出唯一的下一步（开始 / 本地问卷 / 交给 Agent / 检查点确认 / 完成）。
// tick() 负责在阶段完成且检查点已确认时推进台账；一键模式下 autopilotTick() 自动把 Agent 步骤发出去，只在四个检查点停。
import type { Brief, Question } from './types';
import { useFiles, useChats, useAgent, findDocByName } from './store';
import { readLedger, ensureLedger, updateLedger } from './ledger';
import type { Ledger } from './ledger';
import { skillFor, skillStages, briefKeyOf, STAGE_ORDER } from './skills';
import type { Skill, QuestionDef, StageId } from './skills';
import { lintClips, parseSeconds, CLIP_DOC_RE } from './lint';
import { docRole } from './markdown';
import { currentVideoModel, effectivePreset } from './mediagen';
import { projects, NEW_PROJECT_TITLE } from './projects';
import { BRIEF_FORMATS } from './guides';

export type Checkpoint = 'script' | 'assets' | 'prompts' | 'deliver';
export const CHECKPOINTS: Checkpoint[] = ['script', 'assets', 'prompts', 'deliver'];
export interface NextStep {
  stage: StageId; kind: 'start' | 'ask' | 'agent' | 'confirm' | 'done';
  label: string; detail: string; prompt?: string; questions?: QuestionDef[]; checkpoint?: Checkpoint; billable?: boolean; remaining: number;
}

const AUTOPILOT_KEY = 'moodio-autopilot';
export const isAutopilot = () => { try { return localStorage.getItem(AUTOPILOT_KEY) === '1'; } catch { return false; } };
export const setAutopilot = (on: boolean) => { try { localStorage.setItem(AUTOPILOT_KEY, on ? '1' : '0'); } catch { /* ignore */ } window.dispatchEvent(new CustomEvent('moodio:director-changed')); };
let sender: ((text: string) => void) | null = null;
export function setSender(fn: (text: string) => void) { sender = fn; }
const emit = () => window.dispatchEvent(new CustomEvent('moodio:director-changed'));

const has = (v: unknown) => !!String(v || '').trim();
const docByName = (name: string) => findDocByName(name);
const scriptDoc = () => useFiles.getState().docs.filter(d => docRole(d.name) === 'script' && d.content.trim().length >= 200).sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
const storyboardDoc = () => useFiles.getState().docs.find(d => docRole(d.name) === 'storyboard' && d.content.includes('|')) || null;
const shotTableInScript = () => { const s = scriptDoc(); return !!s && /\|\s*镜号\s*\|/.test(s.content); };
const clipDocs = () => useFiles.getState().docs.filter(d => CLIP_DOC_RE.test(d.name));
const composedFilm = () => useFiles.getState().media.find(m => m.kind === 'video' && m.model === '本地合成') || null;
const totalSeconds = (brief: Brief) => parseSeconds(brief.duration) || (brief.format === 'ad' ? 60 : 60);
// 只有产品 / 人物 / 艺人 / 对象必须有参考图；场景、道具、风格锚点可以只靠文字描述
const NEEDS_REF_RE = /产品|人物|艺人|角色|对象/;
const requiredEntities = (ledger: Ledger | null) => (ledger?.entities || []).filter(e => NEEDS_REF_RE.test(e.kind || ''));
const unlinkedImages = (ledger: Ledger | null) => { const refs = new Set((ledger?.entities || []).map(e => e.ref).filter(Boolean)); return useFiles.getState().media.filter(m => m.kind === 'image' && m.by === 'agent' && !refs.has(m.id)); };

// 还没回答的问卷题：台账答案里没有、纲领对应字段也空
export function unansweredQuestions(skill: Skill, bank: QuestionDef[], ledger: Ledger | null, brief: Brief): QuestionDef[] {
  return bank.filter(q => { if (ledger?.answers?.[q.key]) return false; const bk = briefKeyOf(q); return !(bk && has((brief as any)[bk])); });
}
export function expectedClips(skill: Skill, brief: Brief): number { return Math.max(1, Math.ceil(totalSeconds(brief) / skill.clipSeconds)); }
export function estimateMinutes(clips: number, brief: Brief): number {
  const preset = effectivePreset('video', currentVideoModel()); const perClip = preset?.provider === 'ark' ? 3 : 6;
  return Math.round(clips * perClip + totalSeconds(brief) / 60 + 1);
}

export function nextStep(): NextStep {
  const { brief } = useFiles.getState(); const b = brief || {};
  const remainingOf = (stage: StageId) => STAGE_ORDER.length - 1 - STAGE_ORDER.indexOf(stage);
  if (!has(b.format)) return { stage: 'brief', kind: 'start', label: '开始创作', detail: '先选类型，回答几道题，剩下的交给 Agent', remaining: 8 };
  const skill = skillFor(b.format); const ledger = readLedger();
  const stage: StageId = ledger?.stage || 'brief'; const confirmed = ledger?.confirmed || [];
  const stages = skillStages(skill); const cur = stages.find(s => s.id === stage)!; const remaining = remainingOf(stage);
  const base = { stage, remaining };
  switch (stage) {
    case 'brief': {
      const missing = unansweredQuestions(skill, skill.general, ledger, b);
      if (missing.length) return { ...base, kind: 'ask', label: `回答 ${missing.length} 个问题`, detail: '不想选就用推荐值', questions: missing };
      return { ...base, kind: 'agent', label: '进入' + stages[1].name, detail: cur.goal, prompt: `创作纲领已经齐了，用 update_ledger 把阶段推进到 model，然后开始${stages[1].name}：先看台账里已有的答案，不要重复提问。` };
    }
    case 'model': {
      const missing = unansweredQuestions(skill, skill.modeling, ledger, b);
      if (missing.length) return { ...base, kind: 'ask', label: `回答 ${missing.length} 个${skill.modelName}问题`, detail: '答完 Agent 直接写建模文稿', questions: missing };
      const lacking = skill.modelDocs.filter(n => !docByName(n));
      if (lacking.length) return { ...base, kind: 'agent', label: `写${lacking.map(n => '「' + n + '」').join('')}`, detail: '按冻结模板，信息以台账答案为准', prompt: `按建模文稿冻结格式写 ${lacking.map(n => '「' + n + '」').join('、')}，信息以台账里的答案为准，不知道的写 unknown，不要再追问；写完用 update_ledger 把阶段推进到 script。` };
      return { ...base, kind: 'agent', label: '进入脚本阶段', detail: '建模文稿已写好', prompt: '建模文稿已写好，用 update_ledger 把阶段推进到 script，然后开始写故事脚本：先在 message 里给大纲，等我确认。' };
    }
    case 'script': {
      const s = scriptDoc();
      if (!s) return { ...base, kind: 'agent', label: '写故事脚本', detail: cur.goal, prompt: `按写作规范和脚本要求写「故事脚本.md」（60 秒以内直接写分镜脚本表），人物、产品外形以建模文稿为准，写完自审。` };
      if (!confirmed.includes('script')) return { ...base, kind: 'confirm', checkpoint: 'script', label: '确认脚本，进入素材检查', detail: `先在工作区看一遍「${s.name}」，要改就告诉 Agent` };
      return { ...base, kind: 'agent', label: '进入素材检查', detail: '', prompt: '脚本已确认，用 update_ledger 把阶段推进到 assets，然后列出脚本里的实体并按契约安排参考图。' };
    }
    case 'assets': {
      const ents = ledger?.entities || []; const required = requiredEntities(ledger);
      if (!ents.length) return { ...base, kind: 'agent', label: '列实体并生成参考图', detail: cur.goal, prompt: `进入素材检查：列出脚本里需要参考图的实体（${skill.entities.join(' / ')}），按契约处理产品图 / 人物图，先把实体写进台账 entities，再生成参考图；生成完把参考图 id 写进对应实体的 ref。` };
      const noRef = required.filter(e => !e.ref); const spare = unlinkedImages(ledger);
      if (noRef.length && spare.length) return { ...base, kind: 'agent', label: `绑定 ${spare.length} 张已生成的参考图`, detail: noRef.map(e => e.name.slice(0, 12)).join('、'), prompt: `已经生成了这些参考图但还没绑定到实体：${spare.map(m => `${m.id}（${m.name}）`).join('、')}。产品的多张视图先用 make_sheet 拼成一张三视图，然后用 update_ledger 把参考图 id 写进对应实体的 ref（${noRef.map(e => e.name).join('、')}），不要重新生成；确实缺的再补生成。` };
      if (noRef.length) return { ...base, kind: 'agent', label: `生成 ${noRef.length} 张参考图`, detail: noRef.map(e => e.name.slice(0, 12)).join('、'), prompt: `为还没有参考图的实体生成参考图：${noRef.map(e => `${e.name}（${e.kind}）`).join('、')}；产品先出三视图再用 make_sheet 拼成一张；生成完用 update_ledger 把参考图 id 写进对应实体的 ref。` };
      if (!confirmed.includes('assets')) return { ...base, kind: 'confirm', checkpoint: 'assets', label: '参考图通过，进入分镜', detail: '不满意的告诉 Agent 重新生成' };
      return { ...base, kind: 'agent', label: '进入分镜', detail: '', prompt: '参考图已全部确认，用 update_ledger 把阶段推进到 storyboard，然后按分镜规范拆分镜表。' };
    }
    case 'storyboard': {
      if (storyboardDoc() || ((skill.id === 'ad' || skill.id === 'short') && shotTableInScript())) return { ...base, kind: 'agent', label: '进入片段方案', detail: '分镜已就绪', prompt: `分镜已就绪，用 update_ledger 把阶段推进到 prompts，然后按片段提示词冻结格式写 ${expectedClips(skill, b)} 份「视频生成Prompt-NN.md」，全片风格表逐字相同，主体绑定参考图，子镜头时段首尾相接；片段清单写进台账 clips；写完用 lint_clips 自查。` };
      return { ...base, kind: 'agent', label: '拆分镜表', detail: cur.goal, prompt: '按分镜规范把脚本拆成「分镜表.md」（十列 + 全片 BGM），镜头总时长与纲领时长一致。' };
    }
    case 'prompts': {
      const n = expectedClips(skill, b); const have = clipDocs().length;
      if (!have) return { ...base, kind: 'agent', label: `写 ${n} 份片段提示词`, detail: cur.goal, prompt: `按片段提示词冻结格式写 ${n} 份「视频生成Prompt-NN.md」（单段 ${skill.clipSeconds} 秒，最后一段可短），全片风格表逐字相同，主体绑定参考图并原样带冻结外形描述，子镜头时段首尾相接；片段清单写进台账 clips；写完用 lint_clips 自查。` };
      const r = lintClips();
      if (r.errors.length && !ledger?.flags?.skipLint) return { ...base, kind: 'agent', label: `修正 ${r.errors.length} 处校验问题`, detail: r.errors[0], prompt: `片段提示词校验未通过：\n${r.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n请只修改有问题的文稿（write_doc overwrite 或 replace_section），并把台账 clips 改正确。` };
      if (!confirmed.includes('prompts')) return { ...base, kind: 'confirm', checkpoint: 'prompts', label: `确认按此生成（${have} 段，约 ${estimateMinutes(have, b)} 分钟）`, detail: '生成按次计费；先在工作区看一遍片段提示词', billable: true };
      return { ...base, kind: 'agent', label: '开始生成', detail: '', prompt: '片段方案已确认，用 update_ledger 把阶段推进到 video，然后按顺序生成全部片段。' };
    }
    case 'video': {
      const clips = ledger?.clips || []; const n = clips.length || clipDocs().length;
      const made = clips.filter(c => c.mediaId).length;
      if (made < n) { const next = clips.find(c => !c.mediaId); return { ...base, kind: 'agent', label: `生成第 ${next ? next.no : made + 1} 段视频（${made}/${n}）`, detail: `约 ${estimateMinutes(n - made, b)} 分钟`, billable: true, prompt: `按顺序生成还没生成的片段（从第 ${next ? next.no : made + 1} 段起，一次可以安排全部剩余片段）：prompt 照抄对应「视频生成Prompt-NN.md」的正文，有参考图就用 from_media_id 绑定第一张；每段生成完用 update_ledger 把视频 id 写进 clips 的 mediaId。` }; }
      if (!composedFilm()) return { ...base, kind: 'agent', label: '合成成片', detail: `约 ${Math.ceil(totalSeconds(b) / 60)} 分钟`, prompt: '所有片段已生成，用 compose_video 按片段顺序合成 MP4 成片：字幕从脚本的台词 / 口播生成（按各段时长累计起止秒数，每条不超过 20 字），媒体清单里有上传的音频就作配乐；合成完用 update_ledger 把阶段推进到 deliver。' };
      return { ...base, kind: 'agent', label: '交付', detail: '', prompt: '成片已合成，用 update_ledger 把阶段推进到 deliver，然后写交付说明：结构、每段承担的内容、核心信息如何落地，最后请我审阅。' };
    }
    case 'deliver': {
      if (!confirmed.includes('deliver')) return { ...base, kind: 'confirm', checkpoint: 'deliver', label: '验收成片', detail: '要改某一段就告诉 Agent 是哪段、怎么改' };
      return { ...base, kind: 'done', label: '已完成 · 开始新创作', detail: '', remaining: 0 };
    }
  }
  return { ...base, kind: 'agent', label: '继续', detail: '', prompt: '按台账当前阶段继续。' };
}

// 阶段推进：完成条件满足且检查点已确认时，把台账推到下一阶段；能连跳几个就连跳（比如广告脚本已是分镜表，分镜阶段直接过）
export function tick(): boolean {
  let moved = false;
  for (let i = 0; i < STAGE_ORDER.length && tickOnce(); i++) moved = true;
  return moved;
}
function tickOnce(): boolean {
  const { brief } = useFiles.getState(); if (!has(brief?.format)) return false;
  const ledger = readLedger() || ensureLedger(brief!.format).ledger; const skill = skillFor(ledger.skill);
  const advance = (to: StageId) => { updateLedger({ stage: to }); emit(); return true; };
  const idx = STAGE_ORDER.indexOf(ledger.stage); const next = STAGE_ORDER[idx + 1]; if (!next) return false;
  switch (ledger.stage) {
    case 'brief': return unansweredQuestions(skill, skill.general, ledger, brief!).length ? false : advance('model');
    case 'model': return skill.modelDocs.every(n => docByName(n)) && !unansweredQuestions(skill, skill.modeling, ledger, brief!).length ? advance('script') : false;
    case 'script': return scriptDoc() && ledger.confirmed.includes('script') ? advance('assets') : false;
    case 'assets': { const req = requiredEntities(ledger); return ledger.entities.length > 0 && req.every(e => e.ref) && ledger.confirmed.includes('assets') ? advance('storyboard') : false; }
    case 'storyboard': return storyboardDoc() || ((skill.id === 'ad' || skill.id === 'short') && shotTableInScript()) ? advance('prompts') : false;
    case 'prompts': {
      if (!clipDocs().length) return false;
      const r = lintClips();
      // 模型没把片段清单写进台账时，按片段文稿自动补齐（序号、秒数、文稿 id），生成阶段靠它记录每段的视频
      if (!ledger.clips.length && r.clips.length) updateLedger({ clips: r.clips.map(c => ({ no: c.no, seconds: c.seconds, docId: useFiles.getState().docs.find(d => d.name === c.name)?.id, status: '待生成' })) });
      return (ledger.flags.skipLint || !r.errors.length) && ledger.confirmed.includes('prompts') ? advance('video') : false;
    }
    case 'video': return composedFilm() ? advance('deliver') : false;
    default: return false;
  }
}

// 检查点确认：记进台账；参考图检查点顺手把实体状态改成已确认
export function confirmCheckpoint(cp: Checkpoint) {
  const { brief } = useFiles.getState(); if (!has(brief?.format)) return;
  const ledger = readLedger() || ensureLedger(brief!.format).ledger;
  updateLedger({ confirmed: [cp], entities: cp === 'assets' ? ledger.entities.filter(e => e.ref).map(e => ({ name: e.name, status: '已确认' })) : undefined });
  tick(); emit(); resume();
}
export function skipAssets() { updateLedger({ confirmed: ['assets'], notes: (readLedger()?.notes || '') + ' [跳过参考图]' }); tick(); emit(); resume(); }
export function skipLintGate() { updateLedger({ flags: { skipLint: true }, notes: (readLedger()?.notes || '') + ' [跳过片段校验]' }); tick(); emit(); resume(); }
// 用户在检查点点了确认 / 跳过之后，一键模式要马上接着走，不用等下一轮 Agent 回复
const resume = () => { setTimeout(() => { try { autopilotTick(); } catch (e) { console.warn('autopilot', e); } }, 300); };

// 选类型：写纲领、建台账，然后本地渲染第一轮问卷（不经过模型）
export function chooseFormat(format: string) {
  useFiles.getState().setBrief({ format }); ensureLedger(format); emit();
  const step = nextStep(); if (step.kind === 'ask' && step.questions) askLocally(step.questions);
}
// 本地问卷：把题库里的题渲染成追问卡，推荐项预选；提交仍走 answerQuestions（答案进台账与纲领，再交给模型继续）
export function askLocally(questions: QuestionDef[]) {
  const chat = useChats.getState().chat();
  const last = chat.messages[chat.messages.length - 1]; if (last?.questions?.length && !last.questionsUsed) return;   // 已经有一张没答的卡，不重复弹
  const qs: Question[] = questions.map(q => ({ text: q.text, type: q.type, options: q.options, multi: q.multi, placeholder: q.placeholder, key: q.key, recommended: q.recommended }));
  const answers: Record<number, number[]> = {};
  qs.forEach((q, i) => { if (q.type !== 'text' && q.recommended?.length) answers[i] = q.recommended.slice(); });
  useChats.getState().push(chat.id, { role: 'assistant', text: '先确认几件事，不想选就用推荐值：', at: Date.now(), questions: qs, answers, followUpContext: { chatId: chat.id } });
}
// 模型自己发的追问：按 key 或题面在题库里找推荐项预选，让用户也能一键过
export function recommendedAnswers(questions: Question[]): Record<number, number[]> {
  const { brief } = useFiles.getState(); if (!has(brief?.format)) return {};
  const bank = [...skillFor(brief!.format).general, ...skillFor(brief!.format).modeling];
  const out: Record<number, number[]> = {};
  questions.forEach((q, i) => {
    if (q.type === 'text' || !q.options?.length) return;
    const def = bank.find(d => (q.key && d.key === q.key) || d.text === q.text); if (!def?.recommended?.length) return;
    const idx = def.recommended.map(r => { const label = def.options[r]?.label; return q.options.findIndex(o => (typeof o === 'string' ? o : o.label) === label); }).filter(x => x >= 0);
    if (idx.length) { out[i] = idx; q.recommended = idx; }
  });
  return out;
}
// 问卷答案写进纲领对应字段（时长 / 画幅 / 受众 / 调性），这样导演不用等模型 save_brief 就能判断纲领齐不齐
export function applyAnswersToBrief(record: Record<string, string>) {
  const { brief } = useFiles.getState(); if (!has(brief?.format)) return;
  const skill = skillFor(brief!.format); const patch: Record<string, string> = {};
  for (const q of [...skill.general, ...skill.modeling]) { const bk = briefKeyOf(q); const v = record[q.key]; if (bk && v && !has((brief as any)[bk])) patch[bk] = v; }
  if (Object.keys(patch).length) useFiles.getState().setBrief(patch);
  // 创作还叫「新创作」时按类型和主题起名：广告 · 实物产品 / 故事片 · 一个不肯回家的人…
  const subject = record.subject || record.theme || record.song || record.topic || record.goal || record.genre || record.kind || '';
  const name = `${BRIEF_FORMATS[brief!.format!] || '创作'}${subject ? ' · ' + String(subject).replace(/\s+/g, ' ').slice(0, 18) : ''}`;
  if (projects.active().title === NEW_PROJECT_TITLE) projects.rename(projects.active().id, name);
  const chat = useChats.getState().chat(); if (chat.title === '新对话') useChats.getState().renameChat(chat.id, name);
}

// 一键模式：每轮结束后由导演决定是否自动发出下一步；同一提示连续两次没推进就停，检查点必停
let lastAuto = ''; let autoRepeats = 0;
export function autopilotTick() {
  if (!isAutopilot() || useAgent.getState().busy) return;
  tick(); const step = nextStep(); emit();
  if (step.kind === 'ask' && step.questions) { const chat = useChats.getState().chat(); const last = chat.messages[chat.messages.length - 1]; if (!(last?.questions && !last.questionsUsed)) askLocally(step.questions); return; }
  if (step.kind !== 'agent' || !step.prompt || !sender) return;
  if (step.prompt === lastAuto) { autoRepeats++; if (autoRepeats >= 2) return; } else { lastAuto = step.prompt; autoRepeats = 0; }
  sender(step.prompt);
}
export function resetAutopilot() { lastAuto = ''; autoRepeats = 0; }
