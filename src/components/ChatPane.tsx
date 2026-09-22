// ===== 中间对话区：头部（对话文件 / 分享 / 设置）、消息列表（空状态是问候语与建议）、输入框 =====
import { useEffect, useRef } from 'react';
import { FolderOpen, Share2, Settings2, Sparkles, Loader2 } from 'lucide-react';
import { useChats, useFiles, useAgent } from '../lib/store';
import { useTasks } from '../lib/tasks';
import { cancelTask } from '../lib/mediagen';
import { openMenuAt } from './Menu';
import { confirmDialog } from './Dialogs';
import { timeAgo } from '../lib/time';
import { StageStrip } from './LedgerView';
import NextStepBar, { FormatPicker, useNextStep } from './Director';
import { startCreation } from '../lib/session';
import { useT } from '../lib/i18n';
import MessageList from './MessageList';
import type { Chat } from '../lib/types';
import Composer from './Composer';
import { openModelSettings } from './Dialogs';
import { toast } from './Toast';
import { send } from '../lib/agent/runner';
import { modelCfg } from '../lib/model';

const SUGGESTIONS = [
  { label: '写一条 30 秒的广告脚本', prompt: '帮我写一条 30 秒的广告脚本，先问清楚产品和受众再动笔。' },
  { label: '写一个 3 分钟短片的故事脚本', prompt: '帮我写一个 3 分钟短片的故事脚本，先给我故事方向和节拍方案。' },
  { label: '为剧本拆分镜', prompt: '请根据工作区里最新的剧本拆分镜，写成分镜表，先给方案让我确认。' },
  { label: '为分镜生成视频提示词', prompt: '请根据分镜表为每个镜头生成视频生成提示词，先告诉我打算生成哪几个镜头。' },
];

// 后台任务指示器：还在 fal / 方舟那边跑的生成任务，关掉页面也会在重开时接着轮询
function TasksIndicator() {
  const t = useT();
  const all = useTasks(s => s.tasks); const tasks = all.filter(x => x.state === 'running');   // 选择器必须返回稳定引用，过滤放在外面
  if (!tasks.length) return null;
  const open = (el: Element) => openMenuAt(el, tasks.map(x => ({ label: `${x.name}`, hint: `${x.model} · ${timeAgo(x.createdAt)}`, onClick: async () => { if (await confirmDialog({ title: t('取消任务'), body: `取消「${x.name}」的生成？`, okLabel: t('取消任务'), danger: true })) void cancelTask(x.id); } })), { width: 260, title: t('后台任务（点击可取消）') });
  return <button type="button" className="chip-btn tasks-chip" onClick={e => open(e.currentTarget)}><Loader2 size={15} className="spin" /><span>{t('生成中')}</span><em>{tasks.length}</em></button>;
}

// 卡住提醒：有待确认的计划 / 追问或导演给出的下一步，而用户 90 秒没动，就提醒一次
function useStuckHint(chat: Chat, busy: boolean, step: ReturnType<typeof useNextStep>) {
  useEffect(() => {
    let last = Date.now(); let hinted = '';
    const touch = () => { last = Date.now(); };
    document.addEventListener('pointerdown', touch); document.addEventListener('keydown', touch);
    const timer = window.setInterval(() => {
      if (busy || Date.now() - last < 90_000) return;
      const m = chat.messages[chat.messages.length - 1];
      const pending = m?.plan?.state === 'pending' ? '确认或取消刚才的计划' : (m?.questions?.length && !m.questionsUsed) ? '回答上面的问题' : step.kind === 'confirm' || step.kind === 'agent' || step.kind === 'ask' ? step.label : '';
      const key = pending + ':' + (m?.at || 0);
      if (pending && hinted !== key) { hinted = key; toast(`还差一步：${pending}`); last = Date.now(); }
    }, 15_000);
    return () => { clearInterval(timer); document.removeEventListener('pointerdown', touch); document.removeEventListener('keydown', touch); };
  }, [chat.id, chat.messages.length, busy, step.label, step.kind]);
}

export default function ChatPane() {
  const t = useT();
  const step = useNextStep();
  useEffect(() => { const fn = () => { startCreation(); }; window.addEventListener('moodio:new-creation', fn); return () => window.removeEventListener('moodio:new-creation', fn); }, []);
  const chat = useChats(s => s.chats.find(c => c.id === s.active) || s.chats[0]);
  const ui = useFiles(s => s.ui); const setUi = useFiles(s => s.setUi);
  const fileCount = useFiles(s => s.docs.length + s.media.length);
  const busy = useAgent(s => s.busy);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = chat.messages;
  const home = messages.length === 0 && step.kind === 'start';   // 首页：对话框居中，类型卡放在它下面
  const last = messages[messages.length - 1];
  useStuckHint(chat, busy, step);
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (nearBottom || !busy) el.scrollTo({ top: el.scrollHeight, behavior: busy ? 'auto' : 'smooth' });
  }, [messages.length, last?.text, last?.plan?.state, last?.plan?.steps?.map(s => s.status).join(), busy, chat.id]);

  return (
    <section className="chat" aria-label="对话">
      <header className="chat-head">
        <div className="chat-title" title={chat.title}>{chat.title}</div>
        <div className="chat-tools">
          <TasksIndicator />
          {/* Agent 真的产出了文件才出现这个按钮；没有文件时工作区也不展开 */}
          {fileCount > 0 && <button type="button" className={`chip-btn${ui.paneOpen ? ' active' : ''}`} onClick={() => setUi({ paneOpen: !ui.paneOpen })}><FolderOpen size={15} /><span>{t('对话文件')}</span><em>{fileCount}</em></button>}
          <button type="button" className="icon-btn" aria-label={t('分享')} title={t('分享')} onClick={() => toast('原型阶段暂不支持分享')}><Share2 size={17} /></button>
          <button type="button" className={`icon-btn${modelCfg()?.apiKey ? '' : ' attention'}`} aria-label={t('模型设置')} title={modelCfg()?.apiKey ? t('模型设置') : '还没连接模型，点击设置'} onClick={openModelSettings}><Settings2 size={17} /></button>
        </div>
      </header>
      <StageStrip />
      <NextStepBar />
      <div className={`chat-body${home ? ' is-home' : ''}`} ref={listRef}>
        {messages.length ? <MessageList chat={chat} /> : (
          <div className={`chat-empty${home ? ' home' : ''}`}>
            <h1 className="greeting">{t('很高兴见到你')}，<em>Thomas</em></h1>
            <p className="greeting-sub">{t('想做什么？')}{t('选一个类型，回答几道题，剩下的交给 Agent；也可以直接在下面说。')}</p>
            {home ? <><Composer /><FormatPicker home /></> : (
              <div className="suggestions">
                {SUGGESTIONS.map(s => <button key={s.label} type="button" onClick={() => void send(s.prompt)}><Sparkles size={14} />{s.label}</button>)}
              </div>
            )}
          </div>
        )}
      </div>
      {!home && <Composer />}
    </section>
  );
}
