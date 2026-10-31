// ===== 中间对话区：头部（对话文件 / 分享 / 设置）、消息列表（空状态是问候语与建议）、输入框 =====
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FolderOpen, Sparkles, Loader2 } from 'lucide-react';
import { useChats, useFiles, useAgent } from '../lib/store';
import { useTasks } from '../lib/tasks';
import { cancelTask } from '../lib/mediagen';
import { openMenuAt } from './Menu';
import { confirmDialog } from './Dialogs';
import { timeAgo } from '../lib/time';
import NextStepBar, { FormatPicker, useNextStep } from './Director';
import { startCreation } from '../lib/session';
import { useT } from '../lib/i18n';
import MessageList from './MessageList';
import type { Chat } from '../lib/types';
import Composer from './Composer';
import { toast } from './Toast';
import { send } from '../lib/agent/runner';
import { importFiles } from '../lib/upload';

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
  // 首页 → 对话的过渡：首页期间随时记下问候语 / 对话框 / 类型卡的位置；离开首页那一刻，底部的对话框从原位置滑过去（FLIP），问候语与类型卡原地淡出，消息列表淡入
  const sectionRef = useRef<HTMLElement>(null);
  const homeSnap = useRef<{ composer: DOMRect; greeting: DOMRect | null; picker: DOMRect | null } | null>(null);
  const [leaving, setLeaving] = useState<{ greeting: DOMRect | null; picker: DOMRect | null } | null>(null);
  const wasHome = useRef(home);
  useEffect(() => {
    if (!home) return;
    const root = sectionRef.current; if (!root) return;
    const snap = () => { const c = root.querySelector('.chat-empty.home .composer'); if (!c) return; homeSnap.current = { composer: c.getBoundingClientRect(), greeting: root.querySelector('.chat-empty.home .greeting')?.getBoundingClientRect() || null, picker: root.querySelector('.format-picker.home')?.getBoundingClientRect() || null }; };
    snap();
    const target = root.querySelector('.chat-empty.home'); const ro = typeof ResizeObserver !== 'undefined' && target ? new ResizeObserver(snap) : null; ro?.observe(target!);
    window.addEventListener('resize', snap);
    return () => { ro?.disconnect(); window.removeEventListener('resize', snap); };
  }, [home]);
  useLayoutEffect(() => {
    const left = wasHome.current && !home; wasHome.current = home;
    if (!left) return;
    const snap = homeSnap.current; if (!snap || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setLeaving({ greeting: snap.greeting, picker: snap.picker });
    const timer = setTimeout(() => setLeaving(null), 460);
    const el = sectionRef.current?.querySelector(':scope > .composer-wrap .composer') as HTMLElement | null;
    if (el) {
      const now = el.getBoundingClientRect();
      const dx = (snap.composer.left + snap.composer.width / 2) - (now.left + now.width / 2), dy = snap.composer.top - now.top;
      const sx = snap.composer.width / now.width, sy = snap.composer.height / now.height;
      el.style.transition = 'none'; el.style.transformOrigin = 'top center'; el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = 'transform 480ms cubic-bezier(.2, .8, .2, 1)'; el.style.transform = 'none'; }));
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.transformOrigin = ''; }, 540);
    }
    return () => clearTimeout(timer);
  }, [home]);
  const last = messages[messages.length - 1];
  useStuckHint(chat, busy, step);
  useEffect(() => {
    const el = listRef.current; if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (nearBottom || !busy) el.scrollTo({ top: el.scrollHeight, behavior: busy ? 'auto' : 'smooth' });
  }, [messages.length, last?.text, last?.plan?.state, last?.plan?.steps?.map(s => s.status).join(), busy, chat.id]);

  // 拖文件到对话区就收进工作区：图片 / 视频 / 音频进媒体库，字幕 / 文字稿进文稿区
  const [dropping, setDropping] = useState(false);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes('Files');
  const onDragOver = (e: React.DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!dropping) setDropping(true); };
  const onDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false); };
  const onDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); setDropping(false);
    if (e.dataTransfer.files?.length) await importFiles(e.dataTransfer.files);
  };
  // 拖拽没有正常结束时（拖出窗口外松手、按 Esc 取消、在别处放下）对话区收不到 dragleave / drop，浮层会一直挂着：
  // 在 window 上兜底，并且只要一段时间没有新的 dragover 就自己收起（拖动中浏览器每 ~100ms 就发一次 dragover）
  useEffect(() => {
    if (!dropping) return;
    const clear = () => setDropping(false);
    let timer = setTimeout(clear, 900);   // 拖动中 dragover 不断在发，900ms 没动静就是这次拖拽已经结束了
    const keep = () => { clearTimeout(timer); timer = setTimeout(clear, 900); };
    window.addEventListener('dragover', keep);
    window.addEventListener('drop', clear); window.addEventListener('dragend', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('dragover', keep);
      window.removeEventListener('drop', clear); window.removeEventListener('dragend', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, [dropping]);

  return (
    <section className="chat" aria-label="对话" ref={sectionRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <header className="chat-head">
        <div className="chat-title" title={chat.title}>{chat.title}</div>
        <div className="chat-tools">
          <TasksIndicator />
          {/* Agent 真的产出了文件才出现这个按钮；没有文件时工作区也不展开 */}
          {fileCount > 0 && <button type="button" className={`chip-btn${ui.paneOpen ? ' active' : ''}`} onClick={() => setUi({ paneOpen: !ui.paneOpen })}><FolderOpen size={15} /><span>{t('对话文件')}</span><em>{fileCount}</em></button>}
        </div>
      </header>
      <div className={`chat-body${home ? ' is-home' : ''}${leaving ? ' is-entering' : ''}`} ref={listRef}>
        {messages.length ? <MessageList chat={chat} /> : (
          <div className={`chat-empty${home ? ' home' : ''}`}>
            <h1 className="greeting">{t('很高兴见到你')}，<em>Thomas</em></h1>
            {home ? <><Composer /><FormatPicker home /></> : (
              <div className="suggestions">
                {SUGGESTIONS.map(s => <button key={s.label} type="button" onClick={() => void send(s.prompt)}><Sparkles size={14} />{s.label}</button>)}
              </div>
            )}
          </div>
        )}
      </div>
      <NextStepBar />
      {!home && <Composer />}
      {dropping && <div className="chat-drop" aria-hidden="true"><span>{t('松手就把文件放进工作区')}</span></div>}
      {leaving && (
        <div className="home-leaving" aria-hidden="true">
          {leaving.greeting && <h1 className="greeting" style={{ position: 'fixed', left: leaving.greeting.left, top: leaving.greeting.top, width: leaving.greeting.width, margin: 0 }}>{t('很高兴见到你')}，<em>Thomas</em></h1>}
          {leaving.picker && <div style={{ position: 'fixed', left: leaving.picker.left, top: leaving.picker.top, width: leaving.picker.width }}><FormatPicker home /></div>}
        </div>
      )}
    </section>
  );
}
