// ===== 左侧导航：logo / 项目、创作、资源、创作纲领、创作历史（今天 / 昨天 / 更早）、底部用户与设置 =====
import { Sparkles, FolderOpen, Compass, PanelLeft, MoreHorizontal, ChevronDown, FileText, Settings, Languages, Plus, Check } from 'lucide-react';
import { useChats, useFiles, useAgent } from '../lib/store';
import { projects } from '../lib/projects';
import { dayGroup } from '../lib/time';
import { useT, useLang } from '../lib/i18n';
import { openMenuAt } from './Menu';
import { confirmDialog, promptDialog, openBrief, openModelSettings } from './Dialogs';
import { toast } from './Toast';
import { modelCfg, modelLabel } from '../lib/model';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const t = useT(); const lang = useLang(s => s.lang); const toggleLang = useLang(s => s.toggle);
  const chats = useChats(s => s.chats); const active = useChats(s => s.active);
  const newChat = useChats(s => s.newChat); const setActive = useChats(s => s.setActive); const renameChat = useChats(s => s.renameChat); const deleteChat = useChats(s => s.deleteChat);
  const ui = useFiles(s => s.ui); const setUi = useFiles(s => s.setUi);
  const busy = useAgent(s => s.busy);
  const [, bump] = useState(0);
  useEffect(() => projects.subscribe(() => bump(x => x + 1)), []);
  useEffect(() => { const fn = () => bump(x => x + 1); window.addEventListener('moodio:model-changed', fn); return () => window.removeEventListener('moodio:model-changed', fn); }, []);

  const groups: Record<string, typeof chats> = { 今天: [], 昨天: [], 更早: [] };
  chats.slice().sort((a, b) => b.at - a.at).forEach(c => { if (c.messages.length || c.id === active) groups[dayGroup(c.at)].push(c); });

  const openProjectMenu = (el: Element) => {
    const list = projects.list(); const cur = projects.active();
    openMenuAt(el, [
      ...list.map(p => ({ label: p.title, icon: p.id === cur.id ? <Check size={14} /> : undefined, active: p.id === cur.id, onClick: () => { if (p.id !== cur.id) { toast('正在切换项目…'); projects.switchTo(p.id); } } })),
      { label: t('新建项目'), icon: <Plus size={14} />, onClick: async () => { const name = await promptDialog({ title: t('新建项目'), label: '项目名称', placeholder: '例如：一分钟广告' }); if (name) { toast('正在创建项目…'); projects.create(name); } } },
      { label: t('重命名项目'), onClick: async () => { const name = await promptDialog({ title: t('重命名项目'), label: '项目名称', value: cur.title }); if (name) { projects.rename(cur.id, name); bump(x => x + 1); } } },
      { label: t('删除项目'), danger: true, disabled: list.length <= 1, onClick: async () => { if (await confirmDialog({ title: t('删除项目'), body: `删除「${cur.title}」及其全部文件和对话，此操作不可恢复。`, okLabel: '删除', danger: true })) projects.remove(cur.id); } },
    ], { width: 220, title: t('项目') });
  };
  const openChatMenu = (el: Element, id: string, title: string) => openMenuAt(el, [
    { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: title }); if (name) renameChat(id, name); } },
    { label: t('删除'), danger: true, onClick: async () => { if (await confirmDialog({ title: '删除对话', body: `删除「${title}」？工作区里的文件不受影响。`, okLabel: '删除', danger: true })) deleteChat(id); } },
  ], { width: 160, align: 'right' });
  const openSettingsMenu = (el: Element) => openMenuAt(el, [
    { label: t('模型设置'), icon: <Settings size={14} />, hint: modelCfg()?.apiKey ? '已连接' : '未连接', onClick: openModelSettings },
    { label: `${t('语言')} · ${lang === 'zh' ? '中文' : 'English'}`, icon: <Languages size={14} />, onClick: toggleLang },
  ], { width: 220 });

  const collapsed = ui.sidebarCollapsed;
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="导航">
      <div className="sb-head">
        <button type="button" className="sb-logo" onClick={e => openProjectMenu(e.currentTarget)} title={projects.active().title}>
          <img src="./moodio-logo.png" alt="" /><span className="sb-brand">Moodio</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => setUi({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} title={collapsed ? '展开侧栏' : '收起侧栏'}><PanelLeft size={18} /></button>
      </div>
      {!collapsed && (
        <button type="button" className="sb-project" onClick={e => openProjectMenu(e.currentTarget)}>
          <span className="sb-project-name project-title">{projects.active().title}</span><ChevronDown size={14} />
        </button>
      )}
      <nav className="sb-nav" aria-label="板块">
        <button type="button" className="sb-item" onClick={() => { if (busy) { toast('请等待当前 Agent 任务完成。'); return; } newChat(); window.dispatchEvent(new CustomEvent('moodio:focus-composer')); }} title={t('创作')}><Sparkles size={18} /><span>{t('创作')}</span></button>
        <button type="button" className={`sb-item${ui.paneOpen ? ' active' : ''}`} onClick={() => setUi({ paneOpen: !ui.paneOpen })} title={t('资源')}><FolderOpen size={18} /><span>{t('资源')}</span></button>
        <button type="button" className="sb-item" onClick={openBrief} title={t('创作纲领')}><Compass size={18} /><span>{t('创作纲领')}</span></button>
      </nav>
      {!collapsed && (
        <div className="sb-history">
          <div className="sb-history-head"><span>{t('创作历史')}</span></div>
          <div className="sb-history-list">
            {(['今天', '昨天', '更早'] as const).map(g => groups[g].length ? (
              <div key={g} className="sb-group">
                <div className="sb-group-title">{t(g)}</div>
                {groups[g].map(c => (
                  <div key={c.id} className={`sb-chat${c.id === active ? ' active' : ''}`}>
                    <button type="button" className="sb-chat-main" onClick={() => { if (busy && c.id !== active) { toast('请先停止当前 Agent 任务，再切换对话。'); return; } setActive(c.id); }}>
                      <span className="sb-chat-icon"><FileText size={16} /></span><span className="sb-chat-title">{c.title}</span>
                    </button>
                    <button type="button" className="sb-chat-more" aria-label="更多" onClick={e => openChatMenu(e.currentTarget, c.id, c.title)}><MoreHorizontal size={16} /></button>
                  </div>
                ))}
              </div>
            ) : null)}
            {!chats.some(c => c.messages.length) && <p className="sb-empty">还没有对话。点「创作」开始。</p>}
          </div>
        </div>
      )}
      <div className="sb-foot">
        <button type="button" className="sb-user" onClick={e => openSettingsMenu(e.currentTarget)} title={modelLabel(modelCfg())}>
          <span className="sb-avatar">T</span><span className="sb-user-name">Thomas</span>
          <span className={`sb-model-dot${modelCfg()?.apiKey ? ' on' : ''}`} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
