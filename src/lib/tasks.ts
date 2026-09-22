// ===== 后台生成任务：提交给 fal / 方舟之后把任务信息落盘，页面关掉再打开能接着轮询、把结果入库、补回计划卡的步骤 =====
// 任务本来就在对方服务器上跑，浏览器只是丢了轮询；这里只记「去哪里查、结果叫什么、属于哪条消息的第几步」。
import { create } from 'zustand';
import type { Artifact, PlanStep } from './types';
import { projects } from './projects';
import { readJSON, writeJSON } from './storage';
import { useChats } from './store';

export interface GenTask {
  id: string; kind: 'image' | 'video'; provider: 'fal' | 'ark'; name: string; group: string; prompt: string; model: string;
  createdAt: number; statusUrl?: string; responseUrl?: string; cancelUrl?: string; arkTaskId?: string;
  chatId?: string; messageAt?: number; stepIndex?: number;   // 对应计划卡里的哪一步，后台完成后补状态与产物
  state: 'running' | 'done' | 'failed'; error?: string; resultId?: string;
}
export interface TaskRef { chatId?: string; messageAt?: number; stepIndex?: number; }

const key = () => projects.key('moodio-tasks');
interface TasksState { tasks: GenTask[]; add(t: GenTask): void; update(id: string, patch: Partial<GenTask>): void; remove(id: string): void; reload(): void; }
function persist(get: () => TasksState) { writeJSON(key(), get().tasks.slice(0, 50)); }
export const useTasks = create<TasksState>((set, get) => ({
  tasks: readJSON<GenTask[]>(key(), []),
  add(t) { set(s => ({ tasks: [t, ...s.tasks.filter(x => x.id !== t.id)] })); persist(get); },
  update(id, patch) { set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) })); persist(get); },
  remove(id) { set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })); persist(get); },
  reload() { set({ tasks: readJSON<GenTask[]>(key(), []) }); },
}));
export const runningTasks = () => useTasks.getState().tasks.filter(t => t.state === 'running');

// 把后台完成 / 失败的结果补回计划卡：找到那条消息的那一步，改状态与结果，产物加进消息；没有还在跑的步骤时收尾整张卡
export function patchStep(ref: TaskRef, status: PlanStep['status'], result: string, artifact?: Artifact) {
  if (!ref.chatId || !ref.messageAt) return;
  useChats.getState().mutate(all => {
    const c = all.find(x => x.id === ref.chatId); const m = c?.messages.find(x => x.at === ref.messageAt); if (!m?.plan) return;
    const s = typeof ref.stepIndex === 'number' ? m.plan.steps[ref.stepIndex] : undefined;
    if (s) { s.status = status; s.result = result; }
    if (artifact) { m.artifacts = m.artifacts || []; if (!m.artifacts.some(a => a.id === artifact.id)) m.artifacts.push(artifact); }
    if (!m.plan.steps.some(x => x.status === 'running' || x.status === 'pending')) { m.plan.state = m.plan.steps.some(x => x.status === 'failed') ? 'error' : m.plan.steps.some(x => x.status === 'skipped') ? 'stopped' : 'done'; if (!m.text) m.text = m.plan.state === 'done' ? '（页面关闭期间的任务已在后台完成）' : '（页面关闭期间的后台任务已结束，有步骤没有完成）'; }
  });
}

// 页面重新打开：还标着「执行中」的计划卡，有后台任务的步骤保留 running，其余中断的标失败 / 跳过
export function recoverPlans() {
  const running = runningTasks();
  const alive = (chatId: string, at: number, i: number) => running.some(t => t.chatId === chatId && t.messageAt === at && t.stepIndex === i);
  useChats.getState().mutate(all => {
    for (const c of all) for (const m of c.messages) {
      if (!m.plan || !['running', 'reviewing'].includes(m.plan.state)) continue;
      let keep = false;
      m.plan.steps.forEach((s, i) => {
        if (s.status === 'running') { if (alive(c.id, m.at, i)) keep = true; else { s.status = 'failed'; s.result = '页面关闭时中断'; } }
        else if (s.status === 'pending') s.status = 'skipped';
      });
      if (!keep) m.plan.state = m.plan.steps.some(s => s.status === 'failed') ? 'error' : 'stopped';
    }
  });
}
