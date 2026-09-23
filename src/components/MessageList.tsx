// ===== 消息：用户气泡 / 助手气泡（思考过程、正文、计划卡、执行记录、追问卡、产物卡、自审卡、操作按钮、下一步建议）=====
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PenLine, FileText, Image, Trash2, FolderKanban, Download, Sparkles, Dot, Check, X, ListChecks, Wand2, Clapperboard, ChevronLeft, ChevronRight, Film, Music } from 'lucide-react';
import type { Artifact, Chat, Message, Plan, PlanStep, Question } from '../lib/types';
import { useAgent, useFiles, useChats } from '../lib/store';
import { executePlan, cancelPlan, answerQuestions, toggleAnswer, setTextAnswer, useFollowUp, reviewFix, restoreTrash, retryStep, send } from '../lib/agent/runner';
import { skipLintGate } from '../lib/director';
import { mediaUrl } from '../lib/storage';
import { clock } from '../lib/time';
import { toast } from './Toast';
import { runJianyingExport } from './ResourcePane';
import { useT } from '../lib/i18n';

// 导入到剪辑软件用的成片：本地合成的那条优先，否则最新的视频
const latestFilm = () => { const media = useFiles.getState().media; return media.find(x => x.kind === 'video' && x.model === '本地合成') || media.find(x => x.kind === 'video'); };

const KIND_ICON: Record<string, ReactNode> = { write: <PenLine size={14} />, doc: <FileText size={14} />, media: <Image size={14} />, delete: <Trash2 size={14} />, project: <FolderKanban size={14} />, export: <Download size={14} />, brief: <Sparkles size={14} />, image: <Wand2 size={14} />, video: <Clapperboard size={14} />, audio: <Music size={14} />, other: <Dot size={14} /> };
// 连续同类步骤折成一组（写入文件 · 3 份、图片生成 · 完成 2/5 项），像执行了一批命令
const GROUP_LABEL: Record<string, string> = { write: '写入文件', image: '图片生成', video: '视频生成', audio: '语音生成', doc: '读取文件', media: '媒体操作', brief: '记录信息' };

function PlanCard({ plan }: { plan: Plan }) {
  const t = useT();
  const steps = plan.steps, n = steps.length, state = plan.state || 'pending';
  const done = steps.filter(s => s.status === 'done').length, failed = steps.filter(s => s.status === 'failed').length, finished = steps.filter(s => ['done', 'failed', 'skipped'].includes(s.status)).length;
  const destructive = steps.filter(s => s.destructive).length;
  const planning = ['pending', 'confirmed', 'cancelled'].includes(state), folded = state === 'confirmed' || state === 'cancelled';
  const head: Record<string, [string, string, string]> = {
    pending: [`计划 · ${n} 步`, destructive ? `含 ${destructive} 项删除` : t('待确认'), destructive ? 'warn' : ''], confirmed: [`计划 · ${n} 步`, t('已确认'), ''], cancelled: [`计划 · ${n} 步`, t('已取消'), ''],
    running: [`执行中 · 第 ${Math.min(n, finished + 1)} / ${n} 步`, t('进行中'), ''], reviewing: [`执行完成 · ${done} / ${n} 步`, t('正在自审刚写的内容…'), ''], done: [`执行完成 · ${done} / ${n} 步`, t('完成'), ''],
    stopped: [`已停止 · 完成 ${done} / ${n} 步`, t('已停止'), ''], error: [`执行出错 · 完成 ${done} / ${n} 步`, `${failed} 步出错`, 'warn'],
  };
  const [title, badge, badgeCls] = head[state] || head.pending;
  const mark = (s: PlanStep, i: number) => s.status === 'running' ? <span className="plan-spin" /> : s.status === 'done' ? <Check size={12} strokeWidth={3} /> : s.status === 'failed' ? <X size={12} strokeWidth={3} /> : s.status === 'skipped' ? '–' : String(i + 1);
  const row = (s: PlanStep, i: number) => {
    const showPreview = s.preview && (planning || s.status === 'pending' || s.status === 'running');
    return (
      <li key={i} className={`plan-step is-${s.status}${s.destructive ? ' is-destructive' : ''}`}>
        <span className="plan-mark" aria-hidden="true">{mark(s, i)}</span>
        <div className="plan-body">
          <div className="plan-title">{KIND_ICON[s.kind] || KIND_ICON.other}<span>{s.title}</span>{s.destructive && <em className="plan-tag">{t('删除')}</em>}</div>
          {showPreview && <pre className="plan-preview">{s.preview}</pre>}
          {s.status === 'running' && s.logs?.length > 0 && <ul className="plan-log">{s.logs.map((l, j) => <li key={j}>{l}</li>)}</ul>}
          {s.result && ['done', 'failed', 'skipped'].includes(s.status) && <p className="plan-result">{s.result}</p>}
          {s.status === 'failed' && plan.key && !['running', 'reviewing'].includes(state) && <button type="button" className="plan-retry" onClick={() => retryStep(plan.key!, i)}>{t('重试这一步')}</button>}
        </div>
      </li>
    );
  };
  // 分组：连续 ≥ 2 步同类（写入 / 图片 / 视频 / 读取）折叠成一组，执行中的组默认展开
  const groups: { kind: string; idx: number[] }[] = [];
  steps.forEach((s, i) => { const g = groups[groups.length - 1]; if (g && g.kind === s.kind && GROUP_LABEL[s.kind]) g.idx.push(i); else groups.push({ kind: s.kind, idx: [i] }); });
  const rows = groups.map((g, gi) => {
    if (g.idx.length < 2 || !GROUP_LABEL[g.kind]) return g.idx.map(i => row(steps[i], i));
    const gs = g.idx.map(i => steps[i]); const gDone = gs.filter(s => s.status === 'done').length, gRunning = gs.some(s => s.status === 'running'), gFailed = gs.some(s => s.status === 'failed');
    const summary = planning ? `${GROUP_LABEL[g.kind]} · ${gs.length} 项` : `${GROUP_LABEL[g.kind]} · ${gRunning ? '进行中' : gFailed ? `完成 ${gDone}/${gs.length} 项，有出错` : `完成 ${gDone}/${gs.length} 项`}`;
    return (
      <li key={'g' + gi} className={`plan-group${gRunning ? ' is-running' : ''}${gFailed ? ' is-failed' : ''}`}>
        <details open={planning || gRunning || gFailed}>
          <summary><span className="plan-mark" aria-hidden="true">{gRunning ? <span className="plan-spin" /> : gFailed ? <X size={12} strokeWidth={3} /> : gDone === gs.length && !planning ? <Check size={12} strokeWidth={3} /> : String(g.idx[0] + 1)}</span><span className="plan-title">{KIND_ICON[g.kind] || KIND_ICON.other}<span>{summary}</span></span></summary>
          <ol className="plan-steps nested">{g.idx.map(i => row(steps[i], i))}</ol>
        </details>
      </li>
    );
  });
  const header = <><span className="plan-icon"><ListChecks size={14} /></span><strong>{title}</strong>{badge && <span className={`plan-badge${badgeCls ? ' ' + badgeCls : ''}`}>{badge}</span>}</>;
  if (folded) return <details className={`plan is-${state}`}><summary className="plan-head">{header}<small>{t('查看步骤')}</small></summary><ol className="plan-steps">{rows}</ol></details>;
  return <section className={`plan is-${state}`} aria-live="polite"><header className="plan-head">{header}</header>{(state === 'running' || state === 'reviewing') && <div className="plan-bar"><span style={{ width: `${Math.round(finished / n * 100)}%` }} /></div>}<ol className="plan-steps">{rows}</ol></section>;
}

// ===== 追问卡：一次一题、翻页 n/N，单选数字键、多选勾选、填空输入；提交后显示「已提交」并保留答案 =====
const optOf = (o: unknown): { label: string; hint?: string } => typeof o === 'string' ? { label: o } : { label: String((o as any)?.label || ''), hint: (o as any)?.hint };
const typeOf = (q: Question): 'single' | 'multi' | 'text' => q.type || (q.multi ? 'multi' : q.options?.length ? 'single' : 'text');

function QuestionCard({ m, live }: { m: Message; live: boolean }) {
  const t = useT();
  const qs = m.questions!; const answers = m.answers || {}; const texts = m.textAnswers || {};
  const answered = (qi: number) => (answers[qi] || []).length > 0 || !!String(texts[qi] || '').trim();
  const [page, setPage] = useState(0);
  const [custom, setCustom] = useState<Record<number, boolean>>({});
  const qi = Math.min(page, qs.length - 1); const q = qs[qi]; const type = typeOf(q);
  const anyAnswered = qs.some((_, i) => answered(i)); const allAnswered = qs.every((_, i) => answered(i));
  const submitted = !!m.questionsUsed;
  const pick = (oi: number) => {
    if (!live) return; toggleAnswer(m.at, qi, oi);
    if (type === 'single' && qi < qs.length - 1) setTimeout(() => setPage(qi + 1), 220);   // 单选后自动翻到下一题
    else if (type === 'single') setTimeout(() => {   // 最后一题也是单选：全部答完就直接发送，不用再点按钮
      const fresh = useChats.getState().chat().messages.find(x => x.at === m.at); if (!fresh?.questions || fresh.questionsUsed) return;
      const done = fresh.questions.every((_, i) => (fresh.answers?.[i] || []).length > 0 || !!String(fresh.textAnswers?.[i] || '').trim());
      if (done) answerQuestions(m.at, false);
    }, 260);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!live || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'INPUT') return;
    const n = parseInt(e.key, 10); if (n >= 1 && n <= q.options.length && type !== 'text') { e.preventDefault(); pick(n - 1); }
    else if (e.key === 'ArrowLeft' && qi > 0) setPage(qi - 1); else if (e.key === 'ArrowRight' && qi < qs.length - 1) setPage(qi + 1);
  };
  const status = submitted ? t('已提交') : answered(qi) ? t('已选择') : '';
  const showText = type === 'text' || custom[qi] || texts[qi] !== undefined;
  return (
    <div className={`qcard${submitted ? ' is-submitted' : ''}`} tabIndex={0} onKeyDown={onKey} role="group" aria-label={q.text}>
      <header className="qcard-head">
        <p className="q-title">{q.text}</p>
        <div className="q-nav">
          {status && <span className="q-status">{status}</span>}
          {qs.length > 1 && <><button type="button" className="icon-btn" aria-label={t('上一题')} disabled={qi === 0} onClick={() => setPage(qi - 1)}><ChevronLeft size={16} /></button><span className="q-page">{qi + 1}/{qs.length}</span><button type="button" className="icon-btn" aria-label={t('下一题')} disabled={qi === qs.length - 1} onClick={() => setPage(qi + 1)}><ChevronRight size={16} /></button></>}
        </div>
      </header>
      {type !== 'text' && (
        <div className="q-list" role={type === 'multi' ? 'group' : 'radiogroup'}>
          {q.options.map((raw, oi) => {
            const o = optOf(raw); const on = (answers[qi] || []).includes(oi);
            return (
              <button key={oi} type="button" className={`q-row${on ? ' on' : ''}`} disabled={!live} aria-pressed={on} onClick={() => pick(oi)}>
                <span className={type === 'multi' ? 'q-check' : 'q-num'} aria-hidden="true">{type === 'multi' ? (on && <Check size={13} strokeWidth={3} />) : oi + 1}</span>
                <span className="q-body"><span className="q-label">{o.label}{q.recommended?.includes(oi) && <em className="q-rec">{t('推荐')}</em>}</span>{o.hint && <span className="q-hint">{o.hint}</span>}</span>
              </button>
            );
          })}
          {live && !showText && <button type="button" className="q-custom" onClick={() => setCustom({ ...custom, [qi]: true })}>{t('自己填写…')}</button>}
        </div>
      )}
      {showText && <textarea className="q-input" rows={2} value={texts[qi] || ''} placeholder={q.placeholder || (type === 'text' ? '' : t('补充说明…'))} disabled={!live} onChange={e => setTextAnswer(m.at, qi, e.target.value)} />}
      {live && (
        <footer className="q-foot">
          <button type="button" className="primary" disabled={!anyAnswered} onClick={() => answerQuestions(m.at, false)}>{allAnswered || qi === qs.length - 1 ? t('发送回答') : `${t('发送回答')}（${qs.filter((_, i) => answered(i)).length}/${qs.length}）`}</button>
          <button type="button" onClick={() => answerQuestions(m.at, true)}>{t('由 Agent 决定')}</button>
        </footer>
      )}
    </div>
  );
}

// ===== 产物卡：文稿显示成文件卡（查看文件），图片 / 视频铺缩略图 =====
function Thumb({ id, kind }: { id: string; kind: 'image' | 'video' | 'audio' }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; mediaUrl(id).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [id]);
  if (kind === 'audio') return <span className="art-empty"><Music size={18} /></span>;
  if (!url) return <span className="art-empty">{kind === 'image' ? <Image size={18} /> : <Film size={18} />}</span>;
  return kind === 'image' ? <img src={url} alt="" loading="lazy" /> : <video src={url} muted preload="metadata" />;
}
function Artifacts({ items, onOpen }: { items: Artifact[]; onOpen: (id: string) => void }) {
  const t = useT();
  const docs = items.filter(a => a.kind === 'doc'), media = items.filter(a => a.kind !== 'doc');
  return (
    <div className="artifacts">
      {docs.map(a => (
        <button key={a.id} type="button" className="art-file" onClick={() => onOpen(a.id)}>
          <span className="art-icon"><FileText size={18} /></span>
          <span className="art-name">{a.name}</span>
          <span className="art-open">{t('查看文件')}<ChevronRight size={14} /></span>
        </button>
      ))}
      {media.length > 0 && (
        <div className="art-grid">
          {media.map(a => <button key={a.id} type="button" className="art-media" title={a.name} onClick={() => onOpen(a.id)}><Thumb id={a.id} kind={a.kind as 'image' | 'video' | 'audio'} /><span className="art-caption">{a.name}</span></button>)}
        </div>
      )}
    </div>
  );
}

// 参考图质检卡：视觉模型逐张给出通过 / 需重生成、描述与问题
function ImageReviewCard({ m, onOpen }: { m: Message; onOpen: (id: string) => void }) {
  const items = m.imageReview!; const bad = items.filter(x => x.verdict === '需重生成').length;
  return (
    <details className="review image-review" open={bad > 0}>
      <summary>参考图质检 · {items.length} 张 · {bad ? `${bad} 张需重生成` : '全部通过'}</summary>
      <ul className="img-review-list">
        {items.map(it => (
          <li key={it.id} className={it.verdict === '需重生成' ? 'is-bad' : ''}>
            <button type="button" className="img-review-thumb" onClick={() => onOpen(it.id)}><Thumb id={it.id} kind="image" /></button>
            <div className="img-review-body">
              <p><strong>{it.name}</strong><em className={`img-verdict${it.verdict === '需重生成' ? ' bad' : ''}`}>{it.verdict}</em></p>
              {it.description && <p className="img-review-desc">{it.description}</p>}
              {it.issues.length > 0 && <ol>{it.issues.map((x, i) => <li key={i}>{x}</li>)}</ol>}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ReviewCard({ m }: { m: Message }) {
  return (
    <>
      {m.review!.items.map((it, i) => (
        <details key={i} className="review" open={it.verdict === '需修改'}>
          <summary>自审 · 《{it.title}》 · {it.score ? it.score + '/10 · ' : ''}{it.verdict}</summary>
          {it.praise && <p className="review-praise">✓ {it.praise}</p>}
          {it.issues.length > 0 && <><ol>{it.issues.map((x, j) => <li key={j}><strong>{x.point}</strong>{x.fix && <><br /><span>{x.fix}</span></>}</li>)}</ol><button type="button" className="review-fix" onClick={() => reviewFix(m.at, i)}>按自审建议修改这份文稿</button></>}
        </details>
      ))}
    </>
  );
}

export default function MessageList({ chat }: { chat: Chat }) {
  const t = useT();
  const busy = useAgent(s => s.busy);
  const openInPane = useFiles(s => s.openInPane);
  const lastAssistant = useMemo(() => chat.messages.filter(m => m.role === 'assistant').slice(-1)[0], [chat.messages]);
  const onAction = (id: string, m: Message) => {
    if (id.startsWith('plan-confirm:')) { void executePlan(id.slice(13), m.at); return; }
    if (id.startsWith('plan-cancel:')) { cancelPlan(id.slice(12), m.at); return; }
    if (id.startsWith('open-doc:')) { openInPane(id.slice(9)); return; }
    if (id.startsWith('open-media:')) { openInPane(id.slice(11)); return; }
    if (id.startsWith('jianying:')) { void runJianyingExport(id.slice(9)); return; }
    if (id.startsWith('restore-trash:')) { restoreTrash(id.slice(14), m.at); return; }
    if (id.startsWith('review-fix:')) { reviewFix(m.at, parseInt(id.slice(11), 10)); return; }
    toast('这是旧版对话里的操作，请直接在右侧工作区打开文件');
  };
  return (
    <div className="messages">
      {chat.messages.map((m, i) => {
        if (m.role === 'system') return <div key={i} className="msg system">{m.text}</div>;
        if (m.role === 'user') return (
          <div key={i} className="msg-wrap user">
            <div className="msg user">
              {m.quote && <div className="msg-quote"><span>{m.quote.text}</span><small>{m.quote.source || ''}</small></div>}
              {m.display || m.text}
            </div>
            <time className="msg-time">{clock(m.at)}</time>
          </div>
        );
        const latest = m === lastAssistant;
        const liveQ = latest && !!m.questions?.length && !m.questionsUsed && !busy;
        const followUps = m.followUps || [];
        const showFollowUps = followUps.length > 0 && !(m.plan && ['pending', 'confirmed'].includes(m.plan.state)) && !(m.actions || []).some(a => a.id.startsWith('plan-'));
        const followAvailable = latest && !busy && !m.followUpUsed && m.followUpContext?.chatId === chat.id;
        return (
          <div key={i} className={`msg assistant${m.streaming ? ' is-streaming' : ''}`}>
            {m.thinking && <details className="thinking" open={!!m.streaming}><summary>{t('思考过程')}</summary><div>{m.thinking}</div></details>}
            {(m.text || (m.streaming ? t('正在生成…') : '')) && <div className="msg-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{(m.text || t('正在生成…')).replace(/\n/g, '  \n')}</ReactMarkdown>{m.streaming && <span className="stream-cursor" aria-hidden="true" />}</div>}
            {m.plan && m.plan.steps?.length > 0 && <PlanCard plan={m.plan} />}
            {m.artifacts && m.artifacts.length > 0 && <Artifacts items={m.artifacts} onOpen={openInPane} />}
            {m.log && m.log.length > 0 && <details className="exec-log"><summary>执行记录 · {m.log.length} 步</summary><ol>{m.log.map((l, j) => <li key={j}>{l}</li>)}</ol></details>}
            {m.questions && m.questions.length > 0 && <QuestionCard key={m.at} m={m} live={liveQ} />}
            {m.review && m.review.items?.length > 0 && <ReviewCard m={m} />}
            {m.imageReview && m.imageReview.length > 0 && <ImageReviewCard m={m} onOpen={openInPane} />}
            {m.lint && <details className={`review lint-card${m.lint.ok ? ' ok' : ''}`} open={!m.lint.ok}><summary>片段校验 · {m.lint.ok ? '通过' : '有问题'}{m.lint.rounds ? ` · 已修正 ${m.lint.rounds} 轮` : ''}</summary><pre className="lint-text">{m.lint.text}</pre>{!m.lint.ok && latest && !busy && <div className="msg-actions"><button type="button" className="primary" onClick={() => void send('片段提示词校验还有问题，请按校验卡上的清单再修一轮，只改有问题的文稿。', { fromSuggestion: true })}>{t('让 Agent 再修')}</button><button type="button" onClick={skipLintGate}>{t('跳过校验继续')}</button></div>}</details>}
            {m.actions && m.actions.length > 0 && <div className="msg-actions">{m.actions.map(a => <button key={a.id} type="button" className={a.id.startsWith('plan-confirm') ? 'primary' : ''} onClick={() => onAction(a.id, m)}>{a.label}</button>)}</div>}
            {showFollowUps && (
              <div className="next-steps">
                <p className="next-title">{m.followUpUsed ? t('已选择下一步') : !latest ? t('历史建议') : m.followUpContext?.chatId !== chat.id ? t('上下文已变化，请重新提问') : t('你可能还想')}</p>
                <div className="next-options">{followUps.map((f, j) => <button key={j} type="button" disabled={f.action ? busy : !followAvailable} title={f.prompt} onClick={() => f.action === 'nle' ? void runJianyingExport(latestFilm()?.id) : useFollowUp(m.at, j)}>{f.label}</button>)}</div>
              </div>
            )}
            {!m.streaming && <time className="msg-time">{clock(m.at)}</time>}
          </div>
        );
      })}
    </div>
  );
}
