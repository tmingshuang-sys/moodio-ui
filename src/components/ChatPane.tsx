// ===== 中间对话区：头部（对话文件 / 分享 / 设置）、消息列表（空状态是问候语与建议）、输入框 =====
import { useEffect, useRef } from 'react';
import { FolderOpen, Share2, Settings2, Sparkles } from 'lucide-react';
import { useChats, useFiles, useAgent } from '../lib/store';
import { useT } from '../lib/i18n';
import MessageList from './MessageList';
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

export default function ChatPane() {
  const t = useT();
  const chat = useChats(s => s.chats.find(c => c.id === s.active) || s.chats[0]);
  const ui = useFiles(s => s.ui); const setUi = useFiles(s => s.setUi);
  const fileCount = useFiles(s => s.docs.length + s.media.length);
  const busy = useAgent(s => s.busy);
  const listRef = useRef<HTMLDivElement>(null);
  const messages = chat.messages;
  const last = messages[messages.length - 1];
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
          {/* Agent 真的产出了文件才出现这个按钮；没有文件时工作区也不展开 */}
          {fileCount > 0 && <button type="button" className={`chip-btn${ui.paneOpen ? ' active' : ''}`} onClick={() => setUi({ paneOpen: !ui.paneOpen })}><FolderOpen size={15} /><span>{t('对话文件')}</span><em>{fileCount}</em></button>}
          <button type="button" className="icon-btn" aria-label={t('分享')} title={t('分享')} onClick={() => toast('原型阶段暂不支持分享')}><Share2 size={17} /></button>
          <button type="button" className={`icon-btn${modelCfg()?.apiKey ? '' : ' attention'}`} aria-label={t('模型设置')} title={modelCfg()?.apiKey ? t('模型设置') : '还没连接模型，点击设置'} onClick={openModelSettings}><Settings2 size={17} /></button>
        </div>
      </header>
      <div className="chat-body" ref={listRef}>
        {messages.length ? <MessageList chat={chat} /> : (
          <div className="chat-empty">
            <h1 className="greeting">{t('很高兴见到你')}，<em>Thomas</em></h1>
            <p className="greeting-sub">{t('想做什么？')}剧本、分镜、视频提示词都会生成到右侧工作区。</p>
            <div className="suggestions">
              {SUGGESTIONS.map(s => <button key={s.label} type="button" onClick={() => void send(s.prompt)}><Sparkles size={14} />{s.label}</button>)}
            </div>
          </div>
        )}
      </div>
      <Composer />
    </section>
  );
}
