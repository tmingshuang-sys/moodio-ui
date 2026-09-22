// ===== 运行时台账：每次创作一份「台账.json」文稿，记录流程包、当前阶段、问卷答案、实体与参考图、片段清单 =====
// Agent 每轮都能在系统提示里看到它，多轮对话靠它接续；阶段推进由 Agent 调 update_ledger（免确认）完成。
import { useFiles, findDocByName } from './store';
import { skillFor, skillStages, STAGE_ORDER } from './skills';
import type { StageId } from './skills';

export const LEDGER_NAME = '台账.json';
export interface LedgerEntity { name: string; kind: string; ref?: string; voice?: string; status?: string; }      // ref = 参考图媒体 id；voice = 音色样本（音频媒体 id）
export interface LedgerClip { no: number; seconds: number; shots?: string; docId?: string; mediaId?: string; status?: string; }
export interface Ledger { skill: string; stage: StageId; done: StageId[]; answers: Record<string, string>; entities: LedgerEntity[]; clips: LedgerClip[]; notes: string; confirmed: string[]; flags: Record<string, boolean>; updatedAt: number; }   // confirmed：用户点过的检查点（script / assets / prompts / deliver）；flags：skipLint 等开关

const isStage = (s: unknown): s is StageId => STAGE_ORDER.includes(s as StageId);

export function readLedger(): Ledger | null {
  const doc = findDocByName(LEDGER_NAME); if (!doc) return null;
  return parseLedger(doc.content);
}
export function parseLedger(content: string): Ledger | null { try { return normalize(JSON.parse(content || '{}')); } catch { return null; } }
function normalize(raw: any): Ledger {
  return {
    skill: String(raw?.skill || 'other'), stage: isStage(raw?.stage) ? raw.stage : 'brief',
    done: (Array.isArray(raw?.done) ? raw.done : []).filter(isStage),
    answers: raw?.answers && typeof raw.answers === 'object' ? raw.answers : {},
    entities: Array.isArray(raw?.entities) ? raw.entities.filter((e: any) => e && e.name).map((e: any) => ({ name: String(e.name), kind: String(e.kind || ''), ref: e.ref ? String(e.ref) : undefined, voice: e.voice ? String(e.voice) : undefined, status: e.status ? String(e.status) : undefined })) : [],
    clips: Array.isArray(raw?.clips) ? raw.clips.filter((c: any) => c && Number.isFinite(Number(c.no))).map((c: any) => ({ no: Number(c.no), seconds: Number(c.seconds) || 0, shots: c.shots ? String(c.shots) : undefined, docId: c.docId ? String(c.docId) : undefined, mediaId: c.mediaId ? String(c.mediaId) : undefined, status: c.status ? String(c.status) : undefined })) : [],
    notes: String(raw?.notes || ''), confirmed: (Array.isArray(raw?.confirmed) ? raw.confirmed : []).map(String), flags: raw?.flags && typeof raw.flags === 'object' ? Object.fromEntries(Object.entries(raw.flags).map(([k, v]) => [k, !!v])) : {}, updatedAt: Number(raw?.updatedAt) || Date.now(),
  };
}
function write(ledger: Ledger) {
  const content = JSON.stringify(ledger, null, 2);
  const doc = findDocByName(LEDGER_NAME);
  if (doc) useFiles.getState().updateDoc(doc.id, { content, by: 'agent' });
  else useFiles.getState().addDoc({ name: LEDGER_NAME, content, kind: 'json', by: 'agent' });
}

// 纲领里有类型时建立台账；已存在就不动。返回是否新建，用来在对话里显示「已加载创作流程」
export function ensureLedger(format?: string): { ledger: Ledger; created: boolean } {
  const existing = readLedger();
  if (existing) {
    const skill = skillFor(format);
    if (format && existing.skill !== skill.id && existing.stage === 'brief') { const next = { ...existing, skill: skill.id, updatedAt: Date.now() }; write(next); return { ledger: next, created: false }; }
    return { ledger: existing, created: false };
  }
  const ledger: Ledger = { skill: skillFor(format).id, stage: 'brief', done: [], answers: {}, entities: [], clips: [], notes: '', confirmed: [], flags: {}, updatedAt: Date.now() };
  write(ledger); return { ledger, created: true };
}

// 合并更新：answers 合并、entities 按名字替换、clips 按序号替换、done 取并集；stage 只接受合法阶段
export function updateLedger(patch: Record<string, any>): Ledger {   // 补丁字段都可省略、可只填一部分，所以按 any 收
  const cur = readLedger() || ensureLedger(useFiles.getState().brief?.format).ledger;
  const next: Ledger = { ...cur, updatedAt: Date.now() };
  if (isStage(patch.stage)) { next.stage = patch.stage; const idx = STAGE_ORDER.indexOf(patch.stage); next.done = Array.from(new Set([...cur.done, ...STAGE_ORDER.slice(0, idx)])); }
  if (Array.isArray(patch.done)) next.done = Array.from(new Set([...next.done, ...patch.done.filter(isStage)]));
  if (patch.answers && typeof patch.answers === 'object') next.answers = { ...cur.answers, ...Object.fromEntries(Object.entries(patch.answers).map(([k, v]) => [k, String(v)])) };
  // 按名字 / 序号合并：补丁里没写或为空的字段保留原值
  const compact = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== 0)) as Partial<T>;
  if (Array.isArray(patch.entities)) { const merged = cur.entities.slice(); for (const e of normalize({ entities: patch.entities }).entities) { const i = merged.findIndex(x => x.name === e.name); if (i >= 0) merged[i] = { ...merged[i], ...compact(e) }; else merged.push(e); } next.entities = merged; }
  if (Array.isArray(patch.clips)) { const merged = cur.clips.slice(); for (const c of normalize({ clips: patch.clips }).clips) { const i = merged.findIndex(x => x.no === c.no); if (i >= 0) merged[i] = { ...merged[i], ...compact(c) }; else merged.push(c); } next.clips = merged.sort((a, b) => a.no - b.no); }
  if (typeof patch.notes === 'string') next.notes = patch.notes.slice(0, 2000);
  if (Array.isArray(patch.confirmed)) next.confirmed = Array.from(new Set([...cur.confirmed, ...patch.confirmed.map(String)]));
  if (patch.flags && typeof patch.flags === 'object') next.flags = { ...cur.flags, ...Object.fromEntries(Object.entries(patch.flags).map(([k, v]) => [k, !!v])) };
  if (typeof patch.skill === 'string' && skillFor(patch.skill).id === patch.skill) next.skill = patch.skill;
  write(next); return next;
}

export function stageOf(ledger: Ledger) { const stages = skillStages(skillFor(ledger.skill)); const i = Math.max(0, stages.findIndex(s => s.id === ledger.stage)); return { stages, index: i, current: stages[i], next: stages[i + 1] || null }; }
export function ledgerText(ledger: Ledger): string {
  const { stages, current } = stageOf(ledger);
  const chain = stages.map(s => `${s.name}${ledger.done.includes(s.id) && s.id !== ledger.stage ? ' ✓' : s.id === ledger.stage ? '（当前）' : ''}`).join(' → ');
  const answers = Object.entries(ledger.answers).slice(0, 30).map(([k, v]) => `${k}=${String(v).slice(0, 60)}`).join('；');
  const entities = ledger.entities.map(e => `${e.name}（${e.kind}${e.ref ? '，参考图 ' + e.ref : '，无参考图'}${e.voice ? '，音色 ' + e.voice : ''}${e.status ? '，' + e.status : ''}）`).join('；');
  const clips = ledger.clips.map(c => `第 ${c.no} 段 ${c.seconds}s${c.shots ? '（' + c.shots + '）' : ''}${c.docId ? ' 提示词 ' + c.docId : ''}${c.mediaId ? ' 视频 ' + c.mediaId : ''}${c.status ? ' ' + c.status : ''}`).join('；');
  return `阶段链：${chain}\n当前阶段「${current.name}」目标：${current.goal}\n本阶段产物：${current.outputs}；进入下一阶段的条件：${current.gate}\n已记录的答案：${answers || '（无）'}\n实体清单：${entities || '（未建立）'}\n片段清单：${clips || '（未建立）'}${ledger.notes ? '\n备注：' + ledger.notes : ''}`;
}
