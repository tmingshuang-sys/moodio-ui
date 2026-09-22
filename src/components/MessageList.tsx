// ===== 消息：用户气泡 / 助手气泡（思考过程、正文、计划卡、执行记录、追问卡、自审卡、操作按钮、下一步建议）=====
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PenLine, FileText, Image, Trash2, FolderKanban, Download, Sparkles, Dot, Check, X, ListChecks, Wand2, Clapperboard } from 'lucide-react';
import type { Chat, Message, Plan, PlanStep } from '../lib/types';
import { useAgent, useFiles } from '../lib/store';
import { executePlan, cancelPlan, answerQuestions, toggleAnswer, useFollowUp, reviewFix, restoreTrash } from '../lib/agent/runner';
import { toast } from './Toast';
import { useT } from '../lib/i18n';

const KIND_ICON: Record<string, ReactNode> = { write: <PenLine size={14} />, doc: <FileText size={14} />, media: <Image size={14} />, delete: <Trash2 size={14} />, project: <FolderKanban size={14} />, export: <Download size={14} />, brief: <Sparkles size={14} />, image: <Wand2 size={14} />, video: <Clapperboard size={14} />, other: <Dot size={14} /> };

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
  const rows = steps.map((s, i) => {
    const showPreview = s.preview && (planning || s.status === 'pending' || s.status === 'running');
    return (
      <li key={i} className={`plan-step is-${s.status}${s.destructive ? ' is-destructive' : ''}`}>
        <span className="plan-mark" aria-hidden="true">{mark(s, i)}</span>
        <div className="plan-body">
          <div className="plan-title">{KIND_ICON[s.kind] || KIND_ICON.other}<span>{s.title}</span>{s.destructive && <em className="plan-tag">{t('删除')}</em>}</div>
          {showPreview && <pre className="plan-preview">{s.preview}</pre>}
          {s.status === 'running' && s.logs?.length > 0 && <ul className="plan-log">{s.logs.map((l, j) => <li key={j}>{l}</li>)}</ul>}
          {s.result && ['done', 'failed', 'skipped'].includes(s.status) && <p className="plan-result">{s.result}</p>}
        </div>
      </li>
    );
  });
  const header = <><span className="plan-icon"><ListChecks size={14} /></span><strong>{title}</strong>{badge && <span className={`plan-badge${badgeCls ? ' ' + badgeCls : ''}`}>{badge}</span>}</>;
  if (folded) return <details className={`plan is-${state}`}><summary className="plan-head">{header}<small>{t('查看步骤')}</small></summary><ol className="plan-steps">{rows}</ol></details>;
  return <section className={`plan is-${state}`} aria-live="polite"><header className="plan-head">{header}</header>{(state === 'running' || state === 'reviewing') && <div className="plan-bar"><span style={{ width: `${Math.round(finished / n * 100)}%` }} /></div>}<ol className="plan-steps">{rows}</ol></section>;
}

function QuestionCard({ m, live }: { m: Message; live: boolean }) {
  const t = useT();
  const answers = m.answers || {}; const answered = m.questions!.some((q, qi) => (answers[qi] || []).length);
  return (
    <div className="questions">
      {m.questions!.map((q, qi) => (
        <div key={qi} className="q">
          <p>{q.text}</p>
          <div className="q-options">
            {q.options.map((o, oi) => <button key={oi} type="button" className={(answers[qi] || []).includes(oi) ? 'on' : ''} disabled={!live} aria-pressed={(answers[qi] || []).includes(oi)} onClick={() => toggleAnswer(m.at, qi, oi)}>{o}</button>)}
            {live && <button type="button" className="q-custom" onClick={() => window.dispatchEvent(new CustomEvent('moodio:compose', { detail: `${q.text}：` }))}>{t('自己填写…')}</button>}
          </div>
        </div>
      ))}
      {live ? <div className="q-foot"><button type="button" className="primary" disabled={!answered} onClick={() => answerQuestions(m.at, false)}>{t('发送回答')}</button><button type="button" onClick={() => answerQuestions(m.at, true)}>{t('由 Agent 决定')}</button></div>
        : <p className="next-title">{m.questionsUsed ? t('已回答') : t('历史提问')}</p>}
    </div>
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
  const lastAssistant = chat.messages.filter(m => m.role === 'assistant').slice(-1)[0];
  const onAction = (id: string, m: Message) => {
    if (id.startsWith('plan-confirm:')) { void executePlan(id.slice(13), m.at); return; }
    if (id.startsWith('plan-cancel:')) { cancelPlan(id.slice(12), m.at); return; }
    if (id.startsWith('open-doc:')) { openInPane(id.slice(9)); return; }
    if (id.startsWith('open-media:')) { openInPane(id.slice(11)); return; }
    if (id.startsWith('restore-trash:')) { restoreTrash(id.slice(14), m.at); return; }
    if (id.startsWith('review-fix:')) { reviewFix(m.at, parseInt(id.slice(11), 10)); return; }
    toast('这是旧版对话里的操作，请直接在右侧工作区打开文件');
  };
  return (
    <div className="messages">
      {chat.messages.map((m, i) => {
        if (m.role === 'system') return <div key={i} className="msg system">{m.text}</div>;
        if (m.role === 'user') return (
          <div key={i} className="msg user">
            {m.quote && <div className="msg-quote"><span>{m.quote.text}</span><small>{m.quote.source || ''}</small></div>}
            {m.text}
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
            {m.log && m.log.length > 0 && <details className="exec-log"><summary>执行记录 · {m.log.length} 步</summary><ol>{m.log.map((l, j) => <li key={j}>{l}</li>)}</ol></details>}
            {m.questions && m.questions.length > 0 && <QuestionCard m={m} live={liveQ} />}
            {m.review && m.review.items?.length > 0 && <ReviewCard m={m} />}
            {m.actions && m.actions.length > 0 && <div className="msg-actions">{m.actions.map(a => <button key={a.id} type="button" className={a.id.startsWith('plan-confirm') ? 'primary' : ''} onClick={() => onAction(a.id, m)}>{a.label}</button>)}</div>}
            {showFollowUps && (
              <div className="next-steps">
                <p className="next-title">{m.followUpUsed ? t('已选择下一步') : !latest ? t('历史建议') : m.followUpContext?.chatId !== chat.id ? t('上下文已变化，请重新提问') : t('你可能还想')}</p>
                <div className="next-options">{followUps.map((f, j) => <button key={j} type="button" disabled={!followAvailable} title={f.prompt} onClick={() => useFollowUp(m.at, j)}>{f.label}</button>)}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
