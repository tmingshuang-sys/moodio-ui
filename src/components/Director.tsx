// ===== 导演条：常驻在阶段条下方，永远给出唯一的下一步；一键模式开关；空白页的类型选择也在这里 =====
import { useEffect, useState } from 'react';
import { Play, Check, SkipForward, Sparkles, Wand2 } from 'lucide-react';
import { useFiles, useAgent } from '../lib/store';
import { nextStep, tick, confirmCheckpoint, skipAssets, skipLintGate, chooseFormat, askLocally, isAutopilot, setAutopilot, resetAutopilot } from '../lib/director';
import type { NextStep } from '../lib/director';
import { BRIEF_FORMATS } from '../lib/guides';
import { skillFor, skillStages } from '../lib/skills';
import { send, stopAgent } from '../lib/agent/runner';
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
export function FormatPicker({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <div className={`format-picker${compact ? ' compact' : ''}`}>
      {Object.entries(BRIEF_FORMATS).map(([id, name]) => <button key={id} type="button" onClick={() => chooseFormat(id)}><Sparkles size={14} />{t(name)}<small>{skillFor(id).name}</small></button>)}
    </div>
  );
}

export default function NextStepBar() {
  const t = useT();
  const step = useNextStep();
  const busy = useAgent(s => s.busy);
  const [auto, setAuto] = useState(isAutopilot);
  useEffect(() => { const fn = () => setAuto(isAutopilot()); window.addEventListener('moodio:director-changed', fn); return () => window.removeEventListener('moodio:director-changed', fn); }, []);
  const brief = useFiles(s => s.brief);
  if (step.kind === 'start') return null;   // 空白页由 ChatPane 的类型选择承担
  const stages = skillStages(skillFor(brief?.format)); const idx = stages.findIndex(s => s.id === step.stage);
  const primary = () => {
    if (busy) return;
    if (step.kind === 'ask' && step.questions) askLocally(step.questions);
    else if (step.kind === 'agent' && step.prompt) { resetAutopilot(); void send(step.prompt, { fromSuggestion: true }); }
    else if (step.kind === 'confirm' && step.checkpoint) confirmCheckpoint(step.checkpoint);
    else if (step.kind === 'done') window.dispatchEvent(new CustomEvent('moodio:new-creation'));
  };
  const askChange = () => window.dispatchEvent(new CustomEvent('moodio:compose', { detail: step.checkpoint === 'script' ? '请修改脚本：' : step.checkpoint === 'assets' ? '请重新生成这张参考图：' : step.checkpoint === 'prompts' ? '请修改片段方案：' : '请修改成片的第 ' }));
  return (
    <div className={`next-bar${step.kind === 'confirm' ? ' is-confirm' : ''}`} role="region" aria-label={t('下一步')}>
      <div className="next-info">
        <span className="next-stage">{t('现在')}：{stages[idx]?.name || step.stage}<small> · {t('还剩')} {step.remaining} {t('步')}</small></span>
        {step.detail && <span className="next-detail">{step.detail}</span>}
      </div>
      <div className="next-actions">
        {step.kind === 'confirm' && <button type="button" className="next-secondary" onClick={askChange}>{t('让 Agent 修改')}</button>}
        {step.kind === 'confirm' && step.checkpoint === 'assets' && <button type="button" className="next-secondary" onClick={skipAssets}><SkipForward size={13} />{t('跳过参考图')}</button>}
        {step.kind === 'agent' && /校验/.test(step.label) && <button type="button" className="next-secondary" onClick={skipLintGate}><SkipForward size={13} />{t('跳过校验继续')}</button>}
        {busy ? <button type="button" className="next-primary busy" onClick={stopAgent}><span className="plan-spin" />{t('执行中，点击停止')}</button>
          : <button type="button" className="next-primary" onClick={primary}>{step.kind === 'confirm' ? <Check size={15} /> : step.kind === 'done' ? <Sparkles size={15} /> : <Play size={15} />}{step.label}</button>}
        <label className="next-auto" title={t('开着时，除删除和四个检查点外的步骤都自动执行')}><input type="checkbox" checked={auto} onChange={e => { setAutopilot(e.target.checked); setAuto(e.target.checked); if (e.target.checked && !busy) primary(); }} /><Wand2 size={13} />{t('一键模式')}</label>
      </div>
    </div>
  );
}
