// ===== 导演（科普流水线）：下一步同样由代码决定，模型只负责填内容 =====
// 和影视流水线分开写，因为两条流程除了「问卷 → 写文稿 → 检查点」这个骨架之外没有共同的步骤：
// 这边没有生成视频这一步，画面是渲染出来的，所以每一步都可以推倒重来，检查点也更靠后。
import type { Brief } from './types';
import { useFiles, findDocByName } from './store';
import type { Ledger } from './ledger';
import type { Skill, StageDef, StageId, QuestionDef } from './skills';
import { parseSpec, lintSpec } from './render/spec';
import { lintNarration } from './guides';
import type { Checkpoint } from './director';

export interface ExStep {
  stage: StageId; kind: 'ask' | 'agent' | 'confirm' | 'upload' | 'done';
  label: string; detail: string; prompt?: string; questions?: QuestionDef[]; checkpoint?: Checkpoint; billable?: boolean; accept?: string; remaining: number;
}

const docs = () => useFiles.getState().docs;
export const transcriptDoc = () => docs().find(d => /^转写稿/.test(d.name)) || null;
export const pointsDoc = () => findDocByName('知识点清单.md');
export const planDoc = () => findDocByName('选题排期.md');
export const styleDoc = () => findDocByName('风格模板.json');
// 用户拖进来的参考视频：不是我们渲染出来的、也不是本地合成的那些
export const referenceVideo = () => useFiles.getState().media.find(m => m.kind === 'video' && m.model !== '代码渲染' && m.model !== '本地合成') || null;
const twoDigit = (n: number) => String(n).padStart(2, '0');
export const narrationDoc = (no: number) => docs().find(d => d.name === `口播-${twoDigit(no)}.md`) || null;
export const sceneDoc = (no: number) => docs().find(d => d.name === `画面-${twoDigit(no)}.json`) || null;

export interface Topic { no: number; title: string; hook: string; }
// 「选题排期.md」里的表：| 顺序 | 编号 | 标题 | 钩子一句话 | 目标时长 | 画面主线 | 状态 |
export function plannedTopics(): Topic[] {
  const doc = planDoc(); if (!doc) return [];
  const out: Topic[] = [];
  for (const line of doc.content.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()); cells.shift(); if (cells[cells.length - 1] === '') cells.pop();
    if (cells.length < 3) continue;
    const no = parseInt(cells[0], 10);
    if (!Number.isFinite(no) || /顺序|---/.test(cells[0])) continue;
    const title = cells[2] || cells[1] || '';
    if (!title || /^-+$/.test(title)) continue;
    out.push({ no, title: title.replace(/\*\*/g, ''), hook: cells[3] || '' });
  }
  return out.sort((a, b) => a.no - b.no);
}

// 这一条的画面方案渲染出视频没有：台账 clips 里记了 mediaId，并且那个媒体还在
export function renderedIds(ledger: Ledger | null): Map<number, string> {
  const media = useFiles.getState().media;
  const out = new Map<number, string>();
  for (const c of ledger?.clips || []) if (c.mediaId && media.some(m => m.id === c.mediaId)) out.set(c.no, c.mediaId);
  return out;
}
// 还没配音的句数（按画面方案里的 beat 算）
export function unvoiced(no: number): number {
  const d = sceneDoc(no); if (!d) return 0;
  const spec = parseSpec(d.content); if (!spec) return 0;
  return spec.beats.filter(b => b.say && !b.voiceId).length;
}

interface Args { skill: Skill; ledger: Ledger | null; b: Brief; stages: StageDef[]; cur: StageDef; base: { stage: StageId; remaining: number }; confirmed: string[]; }
type Unanswered = (skill: Skill, bank: QuestionDef[], ledger: Ledger | null, brief: Brief) => QuestionDef[];

export function buildExplainerStep({ skill, ledger, b, stages, cur, base, confirmed }: Args, unanswered: Unanswered): ExStep {
  const topics = plannedTopics();
  const stageName = (id: StageId) => stages.find(s => s.id === id)?.name || id;
  const push = (to: StageId, label: string, extra = '') => ({ ...base, kind: 'agent' as const, label, detail: '', prompt: `用 update_ledger 把阶段推进到 ${to}，然后${extra || '开始「' + stageName(to) + '」'}。` });

  switch (base.stage) {
    case 'brief': {
      const missing = unanswered(skill, skill.general, ledger, b);
      if (missing.length) return { ...base, kind: 'ask', label: `回答 ${missing.length} 个问题`, detail: '不想选就用推荐值', questions: missing };
      return push('source', '进入课程转写', '按用户选的来源导入素材：有链接就 import_transcript 带 url；用户上传了字幕 / 文稿就 import_transcript 带那份文稿的 doc_id；都没有就请用户把内容粘贴过来');
    }
    case 'source': {
      const t = transcriptDoc();
      if (!t) {
        const how = String(ledger?.answers?.source || '');
        const hint = /链接/.test(how) ? '用户要给课程链接：请他把链接发过来，然后 import_transcript 带 url（本机助手会用 yt-dlp 抓字幕）'
          : /文件/.test(how) ? '用户有字幕或文稿文件：请他拖进工作区，然后 import_transcript 带那份文稿的 doc_id'
            : '用户要自己讲：请他把内容粘贴过来，然后 import_transcript 带 text';
        return { ...base, kind: 'agent', label: '导入课程素材', detail: cur.goal.slice(0, 40), prompt: `现在做课程转写。${hint}。素材还没拿到就先用一句话问他要，不要编内容。` };
      }
      return push('knowledge', '进入知识点梳理', `用 extract_points 从「${t.name}」里梳理知识点`);
    }
    case 'knowledge': {
      const t = transcriptDoc();
      if (!pointsDoc()) return { ...base, kind: 'agent', label: '梳理知识点', detail: '逐段读转写稿，挑出值得单独做一条的', prompt: `用 extract_points${t ? `（doc_id 写「${t.id}」）` : ''}从转写稿里梳理知识点，写成「知识点清单.md」。这一步只调这一个工具，不要自己凭印象写清单。` };
      if (!planDoc()) {
        const n = String(ledger?.answers?.count || '').match(/\d+/)?.[0] || '3';
        return { ...base, kind: 'agent', label: '定选题与顺序', detail: `从清单里挑出要做的`, prompt: `按「选题排期格式」写「选题排期.md」：从知识点清单里挑约 ${n} 条最值得做的（反常识、有获得感的优先），按观众的理解顺序排，给每条写标题和钩子一句话；同时把知识点清单里被选中的行的「选做」列填上「是」。先在 message 里用一句话说明你为什么挑这几条。` };
      }
      if (!topics.length) return { ...base, kind: 'agent', label: '修正选题排期', detail: '表里没解析出选题', prompt: '「选题排期.md」里没解析出选题行，请按格式重写：表头是 | 顺序 | 编号 | 标题 | 钩子一句话 | 目标时长 | 画面主线 | 状态 |，每条一行，顺序用 1、2、3。' };
      if (!confirmed.includes('plan')) return { ...base, kind: 'confirm', checkpoint: 'plan', label: `确认这 ${topics.length} 条选题`, detail: '先在工作区看一遍「选题排期.md」，要加要减就告诉 Agent' };
      return push('script', '开始写口播稿', '按口播文案规范为第 1 条选题写「口播-01.md」');
    }
    case 'script': {
      const missingDoc = topics.find(t => !narrationDoc(t.no));
      if (missingDoc) return { ...base, kind: 'agent', label: `写第 ${missingDoc.no} 条口播稿`, detail: missingDoc.title.slice(0, 20), prompt: `按口播文案规范写「口播-${twoDigit(missingDoc.no)}.md」，讲的是「${missingDoc.title}」${missingDoc.hook ? `，钩子是「${missingDoc.hook}」` : ''}。一行一句，每句不超过 20 字，句子后面用「｜」跟一句画面提示。内容以转写稿为准，转写稿里没有的不要编。写完用 lint_narration 自查。` };
      for (const t of topics) {
        const d = narrationDoc(t.no)!; const issues = lintNarration(d.content);
        if (issues.length) return { ...base, kind: 'agent', label: `修正第 ${t.no} 条口播稿（${issues.length} 处）`, detail: issues[0].slice(0, 30), prompt: `「${d.name}」自查没过：\n${issues.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n用 write_doc overwrite 重写这一份，改完再 lint_narration。` };
      }
      if (!confirmed.includes('script')) return { ...base, kind: 'confirm', checkpoint: 'script', label: `确认 ${topics.length} 份口播稿`, detail: '在工作区读一遍，读着拗口就告诉 Agent' };
      return push('scene', '进入画面方案', '按画面方案规范把第 1 份口播稿变成「画面-01.json」');
    }
    case 'scene': {
      // 用户拖了参考视频进来又还没分析过：先把配色与节奏抠出来，后面每一条都照着它写
      const ref = referenceVideo();
      if (ref && !styleDoc()) return { ...base, kind: 'agent', label: '分析参考视频', detail: `${ref.name.slice(0, 18)}（配色与节奏）`, prompt: `用户给了参考视频「${ref.name}」（id ${ref.id}），先用 analyze_reference 把它的配色、节奏与字幕位置抠出来写成「风格模板.json」，再按它写画面方案。` };
      const missing = topics.find(t => !sceneDoc(t.no));
      if (missing) {
        const n = narrationDoc(missing.no);
        return { ...base, kind: 'agent', label: `写第 ${missing.no} 条画面方案`, detail: missing.title.slice(0, 20), prompt: `按画面方案规范写「画面-${twoDigit(missing.no)}.json」，口播稿是${n ? `「${n.name}」（id ${n.id}）` : `「口播-${twoDigit(missing.no)}.md」`}。每句口播一个 beat，say 与口播稿原文逐字相同；按内容选模板（有数字上 number、有顺序上 steps、有对比上 compare、有出处上 quote），连着两段不要用同一个模板；第一段必须是 hook，最后一段必须是 endcard；不要自己填 seconds。title 写「${missing.title}」，no 写 ${missing.no}，${styleDoc() ? 'ratio / theme / palette / subtitle 原样抄「风格模板.json」里的值' : 'ratio 与 theme 按纲领'}。写完用 lint_scene 自查。` };
      }
      for (const t of topics) {
        const d = sceneDoc(t.no)!; const spec = parseSpec(d.content);
        const issues = spec ? lintSpec(spec) : ['不是合法的 JSON'];
        if (issues.length) return { ...base, kind: 'agent', label: `修正第 ${t.no} 条画面方案（${issues.length} 处）`, detail: issues[0].slice(0, 30), prompt: `「${d.name}」自查没过：\n${issues.map((x, i) => `${i + 1}. ${x}`).join('\n')}\n用 write_doc overwrite 重写这一份，改完再 lint_scene。` };
      }
      if (ledger?.flags?.skipVoice) return push('render', '跳过配音，直接渲染', '用 render_scene 渲染第 1 条（没有配音，时长按字数估）');
      return push('narrate', '进入配音', '用 narrate_scene 给第 1 条逐句配音');
    }
    case 'narrate': {
      if (ledger?.flags?.skipVoice) return push('render', '进入渲染', '用 render_scene 逐条渲染');
      const todo = topics.find(t => unvoiced(t.no) > 0);
      if (todo) {
        const d = sceneDoc(todo.no)!; const n = unvoiced(todo.no);
        return { ...base, kind: 'agent', label: `给第 ${todo.no} 条配音（${n} 句）`, detail: todo.title.slice(0, 20), billable: true, prompt: `用 narrate_scene 给「${d.name}」（id ${d.id}）逐句配音${ledger?.answers?.voice ? `，口播人称是「${ledger.answers.voice}」` : ''}。一次只做这一条。` };
      }
      return push('render', '进入渲染', '用 render_scene 逐条渲染成 MP4');
    }
    case 'render': {
      const done = renderedIds(ledger);
      const todo = topics.find(t => !done.has(t.no));
      if (todo) {
        const d = sceneDoc(todo.no)!;
        return { ...base, kind: 'agent', label: `渲染第 ${todo.no} 条`, detail: `${todo.title.slice(0, 16)}（本地渲染，不计费）`, prompt: `用 render_scene 渲染「${d.name}」（id ${d.id}），渲完用 update_ledger 把视频 id 写进 clips 第 ${todo.no} 段的 mediaId（no: ${todo.no}，shots 写标题「${todo.title}」）。一次只渲这一条。` };
      }
      return push('compose', '进入成片检查', `把 ${topics.length} 条成片列出来请用户逐条看`);
    }
    case 'compose': {
      if (!confirmed.includes('film')) return { ...base, kind: 'confirm', checkpoint: 'film', label: `验收 ${topics.length} 条成片`, detail: '逐条看一遍：有没有压字、字幕超框、节奏太快；要改就说是第几条、改哪里' };
      return push('deliver', '写交付说明', '按发布顺序列出每条的标题、钩子、时长与文件，并给发布建议');
    }
    case 'deliver': {
      if (!confirmed.includes('deliver')) return { ...base, kind: 'confirm', checkpoint: 'deliver', label: '交付验收', detail: '要改哪一条就告诉 Agent' };
      return { ...base, kind: 'done', label: '已完成 · 开始新创作', detail: '', remaining: 0 };
    }
  }
  return { ...base, kind: 'agent', label: '继续', detail: '', prompt: '按台账当前阶段继续。' };
}

// 阶段推进：条件满足就往下走一格（检查点必须已确认）
export function explainerTickOnce(ledger: Ledger, advance: (to: StageId) => boolean): boolean {
  const topics = plannedTopics();
  switch (ledger.stage) {
    case 'source': return transcriptDoc() ? advance('knowledge') : false;
    case 'knowledge': return pointsDoc() && topics.length && ledger.confirmed.includes('plan') ? advance('script') : false;
    case 'script': return topics.length && topics.every(t => { const d = narrationDoc(t.no); return d && !lintNarration(d.content).length; }) && ledger.confirmed.includes('script') ? advance('scene') : false;
    case 'scene': {
      const ok = topics.length && topics.every(t => { const d = sceneDoc(t.no); const spec = d && parseSpec(d.content); return spec && !lintSpec(spec).length; });
      return ok ? advance(ledger.flags?.skipVoice ? 'render' : 'narrate') : false;
    }
    case 'narrate': return ledger.flags?.skipVoice || (topics.length && topics.every(t => unvoiced(t.no) === 0)) ? advance('render') : false;
    case 'render': { const done = renderedIds(ledger); return topics.length && topics.every(t => done.has(t.no)) ? advance('compose') : false; }
    case 'compose': return ledger.confirmed.includes('film') ? advance('deliver') : false;
    default: return false;
  }
}
