// ===== 台账的进度视图：阶段时间线、已记录的答案、实体与参考图、片段清单；对话顶部的阶段条也在这里 =====
import { useEffect, useState } from 'react';
import { Check, ChevronRight, FileText, Film, Image as ImageIcon } from 'lucide-react';
import type { Doc } from '../lib/types';
import { useFiles, findDoc, findMedia } from '../lib/store';
import { parseLedger, stageOf, LEDGER_NAME } from '../lib/ledger';
import type { Ledger } from '../lib/ledger';
import { skillFor } from '../lib/skills';
import { mediaUrl } from '../lib/storage';
import { timeAgo } from '../lib/time';
import { useT } from '../lib/i18n';

function Thumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; mediaUrl(id).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [id]);
  const m = findMedia(id);
  if (!m) return <span className="lg-thumb empty"><ImageIcon size={16} /></span>;
  return <span className="lg-thumb">{url ? (m.kind === 'image' ? <img src={url} alt="" /> : <video src={url} muted preload="metadata" />) : <ImageIcon size={16} />}</span>;
}

// 阶段时间线：完成 ✓ / 当前 ● / 未到 ○
export function StageLine({ ledger, compact = false }: { ledger: Ledger; compact?: boolean }) {
  const { stages, index } = stageOf(ledger);
  return (
    <ol className={`lg-stages${compact ? ' compact' : ''}`}>
      {stages.map((s, i) => {
        const done = i < index || (ledger.done.includes(s.id) && i !== index); const cur = i === index;
        return <li key={s.id} className={cur ? 'is-current' : done ? 'is-done' : ''}><span className="lg-dot">{done ? <Check size={10} strokeWidth={3} /> : cur ? <span className="lg-cur" /> : null}</span><span className="lg-stage-name">{s.name}</span>{i < stages.length - 1 && <ChevronRight size={12} className="lg-arrow" />}</li>;
      })}
    </ol>
  );
}

// 对话顶部的阶段条：有台账才显示，点击在工作区打开台账
export function StageStrip() {
  const docs = useFiles(s => s.docs); const openInPane = useFiles(s => s.openInPane);
  const doc = docs.find(d => d.name === LEDGER_NAME); const ledger = doc ? parseLedger(doc.content) : null;
  if (!doc || !ledger) return null;
  const skill = skillFor(ledger.skill);
  return (
    <button type="button" className="stage-strip" onClick={() => openInPane(doc.id)} title="查看创作进度">
      <span className="stage-skill">{skill.name}</span>
      <StageLine ledger={ledger} compact />
    </button>
  );
}

export default function LedgerView({ doc }: { doc: Doc }) {
  const t = useT();
  const openInPane = useFiles(s => s.openInPane);
  const ledger = parseLedger(doc.content);
  if (!ledger) return <p className="md-empty">台账内容不是合法 JSON，切到「编辑」修正。</p>;
  const skill = skillFor(ledger.skill); const { current, next } = stageOf(ledger);
  const bank = [...skill.general, ...skill.modeling];
  const questionText = (key: string) => bank.find(q => q.key === key)?.text || key;
  const answers = Object.entries(ledger.answers);
  return (
    <div className="ledger">
      <header className="lg-head">
        <div><p className="lg-skill">{skill.name} · {skill.title}</p><h2>{t('当前阶段')}：{current.name}</h2></div>
        <p className="lg-time">{t('更新于')} {timeAgo(ledger.updatedAt)}</p>
      </header>
      <StageLine ledger={ledger} />
      <section className="lg-section">
        <h3>{t('本阶段')}</h3>
        <p><strong>{t('目标')}</strong>{current.goal}</p>
        <p><strong>{t('产物')}</strong>{current.outputs}</p>
        <p><strong>{t('进入下一阶段的条件')}</strong>{current.gate}{next ? `　→ ${next.name}` : ''}</p>
      </section>
      <section className="lg-section">
        <h3>{t('已确认的信息')}<small>{answers.length}</small></h3>
        {answers.length ? <table className="lg-table"><tbody>{answers.map(([k, v]) => <tr key={k}><th>{questionText(k)}</th><td>{v}</td></tr>)}</tbody></table> : <p className="lg-empty">—</p>}
      </section>
      <section className="lg-section">
        <h3>{t('实体与参考图')}<small>{ledger.entities.length}</small></h3>
        {ledger.entities.length ? (
          <ul className="lg-entities">{ledger.entities.map(e => (
            <li key={e.name}>
              {e.ref ? <button type="button" className="lg-thumb-btn" onClick={() => openInPane(e.ref!)}><Thumb id={e.ref} /></button> : <span className="lg-thumb empty"><ImageIcon size={16} /></span>}
              <span className="lg-entity-name">{e.name}</span><em className="lg-chip">{e.kind || '实体'}</em><em className={`lg-chip${e.status === '已确认' ? ' ok' : e.ref ? ' warn' : ''}`}>{e.status || (e.ref ? '待确认' : '无参考图')}</em>{e.voice ? <em className="lg-chip">{t('音色')}</em> : null}
            </li>
          ))}</ul>
        ) : <p className="lg-empty">—</p>}
      </section>
      <section className="lg-section">
        <h3>{t('片段')}<small>{ledger.clips.length}</small></h3>
        {ledger.clips.length ? (
          <ul className="lg-clips">{ledger.clips.map(c => {
            const d = c.docId ? findDoc(c.docId) : null; const v = c.mediaId ? findMedia(c.mediaId) : null;
            return (
              <li key={c.no}>
                <span className="lg-clip-no">{c.no}</span>
                <span className="lg-clip-body"><span>{c.seconds}s{c.shots ? ` · ${t('镜头')} ${c.shots}` : ''}</span>
                  <span className="lg-clip-links">
                    {d && <button type="button" onClick={() => openInPane(d.id)}><FileText size={13} />{d.name}</button>}
                    {v && <button type="button" onClick={() => openInPane(v.id)}><Film size={13} />{v.name}</button>}
                  </span>
                </span>
                <em className={`lg-chip${v ? ' ok' : ''}`}>{c.status || (v ? '已生成' : '待生成')}</em>
              </li>
            );
          })}</ul>
        ) : <p className="lg-empty">—</p>}
      </section>
      {ledger.notes && <section className="lg-section"><h3>{t('备注')}</h3><p>{ledger.notes}</p></section>}
    </div>
  );
}
