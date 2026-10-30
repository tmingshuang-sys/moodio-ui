// ===== 导演停靠区：贴在输入框上方——一张步骤清单卡（八个阶段，当前步骤带下一步动作）、一颗进度胶囊（Step k / 8，点了收起 / 展开清单）和主按钮；一键模式开关；空白页的类型选择也在这里 =====
import { useEffect, useState } from 'react';
import { Check, SkipForward, Sparkles, Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { LEDGER_NAME } from '../lib/ledger';
const DOCK_KEY = 'moodio-dock-open';   // 步骤清单卡收起 / 展开的记忆
import { useFiles, useAgent } from '../lib/store';
import { pickFiles, uploadFiles } from '../lib/upload';
import { nextStep, runNextStep, tick, confirmCheckpoint, skipAssets, skipLintGate, skipVoice, skipSong, chooseFormat, askLocally, isAutopilot, setAutopilot, resetAutopilot, autopilotPaused } from '../lib/director';
import type { NextStep } from '../lib/director';
import { BRIEF_FORMATS } from '../lib/guides';
import { skillFor, skillStages } from '../lib/skills';
import { send } from '../lib/agent/runner';
import { useT } from '../lib/i18n';

export function useNextStep(): NextStep {
  const docs = useFiles(s => s.docs); const media = useFiles(s => s.media); const brief = useFiles(s => s.brief);
  const [version, bump] = useState(0);
  useEffect(() => { const fn = () => bump(x => x + 1); window.addEventListener('moodio:director-changed', fn); return () => window.removeEventListener('moodio:director-changed', fn); }, []);
  const [step, setStep] = useState<NextStep>(() => nextStep());
  useEffect(() => { try { tick(); setStep(nextStep()); } catch (e) { console.warn('director', e); } }, [docs, media, brief, version]);
  return step;
}

// 类型选择：六个类型，点一个就建纲领、建台账、弹本地问卷
// 首页只放四个主类型排成一行（剧集 / 其他仍可通过纲领或对话选择）
const HOME_FORMATS = ['explainer', 'ad', 'film', 'short'];   // 首页只列四个最常用的；MV / 剧集 / 其他仍可在纲领里选
export function FormatPicker({ compact = false, home = false }: { compact?: boolean; home?: boolean }) {
  const t = useT();
  const entries = Object.entries(BRIEF_FORMATS).filter(([id]) => !home || HOME_FORMATS.includes(id));
  return (
    <div className={`format-picker${compact ? ' compact' : ''}${home ? ' home' : ''}`}>
      {entries.map(([id, name]) => <button key={id} type="button" onClick={() => chooseFormat(id)}><Sparkles size={14} />{t(name)}<small>{skillFor(id).name}</small></button>)}
    </div>
  );
}

export default function NextStepBar() {
  const t = useT();
  const step = useNextStep();
  const busy = useAgent(s => s.busy); const live = useAgent(s => s.live);
  const [auto, setAuto] = useState(isAutopilot);
  // 默认收起，只有用户点过胶囊展开才记住（用户要求：一上来别占半屏）
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(DOCK_KEY) === '1'; } catch { return false; } });
  useEffect(() => { const fn = () => setAuto(isAutopilot()); window.addEventListener('moodio:director-changed', fn); return () => window.removeEventListener('moodio:director-changed', fn); }, []);
  const brief = useFiles(s => s.brief); const docs = useFiles(s => s.docs); const openInPane = useFiles(s => s.openInPane);
  if (step.kind === 'start') return null;   // 空白页由 ChatPane 的类型选择承担
  const skill = skillFor(brief?.format); const stages = skillStages(skill); const idx = Math.max(0, stages.findIndex(s => s.id === step.stage));
  const toggle = () => setOpen(o => { try { localStorage.setItem(DOCK_KEY, o ? '0' : '1'); } catch { /* ignore */ } return !o; });
  const ledgerDoc = docs.find(d => d.name === LEDGER_NAME);
  const primary = () => {
    if (busy) return;
    // ask / agent / confirm 走 runNextStep（自审卡的「不修改」用的是同一个入口），upload 与 done 要界面配合
    if (step.kind === 'upload') { void pickFiles(step.accept || 'audio/*', false).then(files => files.length ? uploadFiles(files, { group: '配乐' }) : []).then(() => { tick(); window.dispatchEvent(new CustomEvent('moodio:director-changed')); }); return; }
    if (step.kind === 'done') { window.dispatchEvent(new CustomEvent('moodio:new-creation')); return; }
    runNextStep();
  };
  const askChange = () => window.dispatchEvent(new CustomEvent('moodio:compose', { detail: step.checkpoint === 'script' ? '请修改脚本：' : step.checkpoint === 'assets' ? '请重新生成这张参考图：' : step.checkpoint === 'prompts' ? '请修改片段方案：' : '请修改成片的第 ' }));
  const secondary = [
    step.kind === 'confirm' && <button key="change" type="button" className="next-secondary" onClick={askChange}>{t('让 Agent 修改')}</button>,
    step.kind === 'confirm' && step.checkpoint === 'assets' && <button key="assets" type="button" className="next-secondary" onClick={skipAssets}><SkipForward size={13} />{t('跳过参考图')}</button>,
    step.kind === 'agent' && /校验/.test(step.label) && <button key="lint" type="button" className="next-secondary" onClick={skipLintGate}><SkipForward size={13} />{t('跳过校验继续')}</button>,
    step.kind === 'agent' && /音色样本|旁白配音/.test(step.label) && <button key="voice" type="button" className="next-secondary" onClick={skipVoice}><SkipForward size={13} />{t('跳过音色')}</button>,
    step.kind === 'upload' && <button key="song" type="button" className="next-secondary" onClick={skipSong}><SkipForward size={13} />{t('没有歌曲，先跳过')}</button>,
  ].filter(Boolean);
  const current = busy && live ? live : step.kind === 'done' ? step.label : `${stages[idx]?.name || step.stage} · ${step.label}`;
  return (
    <div className="dock" role="region" aria-label={t('下一步')}>
      {open && (
        <div className="dock-card">
          <header className="dock-head">
            <button type="button" className="dock-skill" onClick={() => ledgerDoc && openInPane(ledgerDoc.id)} title={t('查看创作进度')}>{skill.name}<small> · {t('还剩')} {step.remaining} {t('步')}</small></button>
            <label className="next-auto" title={t('开着时，除删除和四个检查点外的步骤都自动执行')}><input type="checkbox" checked={auto} onChange={e => { setAutopilot(e.target.checked); setAuto(e.target.checked); if (e.target.checked && !busy) primary(); }} /><Wand2 size={13} />{t('一键模式')}</label>
          </header>
          <ol className="dock-steps">
            {stages.map((s, i) => {
              const state = step.kind === 'done' ? 'done' : i < idx ? 'done' : i === idx ? 'current' : 'pending';
              return (
                <li key={s.id} className={`is-${state}${state === 'current' && !busy ? ' can-act' : ''}`} role={state === 'current' && !busy ? 'button' : undefined} tabIndex={state === 'current' && !busy ? 0 : undefined} onClick={state === 'current' && !busy ? primary : undefined} onKeyDown={state === 'current' && !busy ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); primary(); } }) : undefined} title={state === 'current' && !busy ? step.label : undefined}>
                  <span className="dock-icon">{state === 'done' ? <Check size={12} strokeWidth={3} /> : state === 'current' ? (busy ? <span className="plan-spin" /> : <span className="dock-dot" />) : <span className="dock-ring" />}</span>
                  <span className="dock-text">{s.name}{state === 'current' && step.kind !== 'done' && <em> · {busy && live ? live : step.label}</em>}</span>
                </li>
              );
            })}
          </ol>
          {step.detail && step.kind !== 'done' && <p className="dock-detail">{step.detail}</p>}
          {auto && !busy && autopilotPaused() && step.kind === 'agent' && <p className="dock-paused">{t('一键模式已暂停：上一步没有推进。点当前步骤重试，或告诉 Agent 怎么改。')}</p>}
          {secondary.length > 0 && <div className="dock-secondary">{secondary}</div>}
        </div>
      )}
      <div className="dock-bar">
        <button type="button" className="dock-pill" onClick={toggle} aria-expanded={open} title={open ? t('收起步骤') : t('展开步骤')}>
          {busy && <span className="plan-spin" />}
          <span className="dock-pill-text">Step {Math.min(idx + 1, stages.length)} / {stages.length} · {current}</span>
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
    </div>
  );
}
