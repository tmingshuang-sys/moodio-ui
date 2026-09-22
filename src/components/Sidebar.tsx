// ===== 左侧导航：logo / 项目、创作、资源、创作纲领、创作历史（今天 / 昨天 / 更早）、底部用户与设置 =====
// 「创作」= 新建一个空白创作（项目）并切换过去；创作历史列出所有项目里有内容的对话，点一条切回那个项目（不刷新页面）
import { Sparkles, FolderOpen, Compass, PanelLeft, MoreHorizontal, ChevronDown, FileText, Settings, Languages, Plus, Check } from 'lucide-react';
import { useChats, useFiles, useAgent, useNav } from '../lib/store';
import { projects } from '../lib/projects';
import { startCreation, switchProject, deleteCreation, otherProjectsHistory, chatCount, renameHistoryChat, deleteHistoryChat } from '../lib/session';
import type { HistoryEntry } from '../lib/session';
import { dayGroup } from '../lib/time';
import { useT, useLang } from '../lib/i18n';
import { openMenuAt } from './Menu';
import { confirmDialog, promptDialog, openBrief, openModelSettings } from './Dialogs';
import { toast } from './Toast';
import { modelCfg, modelLabel } from '../lib/model';
import { useEffect, useMemo, useState } from 'react';

export default function Sidebar() {
  const t = useT(); const lang = useLang(s => s.lang); const toggleLang = useLang(s => s.toggle);
  const chats = useChats(s => s.chats); const active = useChats(s => s.active);
  const setActive = useChats(s => s.setActive);
  const ui = useFiles(s => s.ui); const setUi = useFiles(s => s.setUi);
  const page = useNav(s => s.page); const go = useNav(s => s.go);
  const busy = useAgent(s => s.busy);
  const [version, bump] = useState(0);
  useEffect(() => projects.subscribe(() => bump(x => x + 1)), []);
  useEffect(() => {
    const fn = () => bump(x => x + 1);
    window.addEventListener('moodio:model-changed', fn); window.addEventListener('moodio:project-changed', fn);
    return () => { window.removeEventListener('moodio:model-changed', fn); window.removeEventListener('moodio:project-changed', fn); };
  }, []);

  // 创作历史 = 当前项目的对话（内存，随流式更新）+ 其他项目的对话（读一次 localStorage，只在项目变动时重算）
  const cur = projects.active();
  const others = useMemo(() => otherProjectsHistory(), [cur.id, version]);   // eslint-disable-line react-hooks/exhaustive-deps
  type Entry = HistoryEntry & { current: boolean };
  const entries: Entry[] = [
    ...chats.filter(c => c.messages.length || c.id === active).map(c => ({ projectId: cur.id, projectTitle: cur.title, chatId: c.id, title: c.title, at: c.at, current: true })),
    ...others.map(e => ({ ...e, current: false })),
  ].sort((a, b) => b.at - a.at);
  const groups: Record<string, Entry[]> = { 今天: [], 昨天: [], 更早: [] };
  entries.forEach(e => groups[dayGroup(e.at)].push(e));

  const openProjectMenu = (el: Element) => {
    const list = projects.list();
    openMenuAt(el, [
      ...list.map(p => ({ label: p.title, icon: p.id === cur.id ? <Check size={14} /> : undefined, active: p.id === cur.id, onClick: () => { switchProject(p.id); } })),
      { label: t('新建项目'), icon: <Plus size={14} />, onClick: async () => { const name = await promptDialog({ title: t('新建项目'), label: '项目名称', placeholder: '例如：一分钟广告' }); if (name) startCreation(name, { reuseBlank: false }); } },
      { label: t('重命名项目'), onClick: async () => { const name = await promptDialog({ title: t('重命名项目'), label: '项目名称', value: cur.title }); if (name) { projects.rename(cur.id, name); bump(x => x + 1); } } },
      { label: t('删除项目'), danger: true, onClick: async () => { if (await confirmDialog({ title: t('删除项目'), body: `删除「${cur.title}」及其全部文件和对话，此操作不可恢复。`, okLabel: '删除', danger: true })) deleteCreation(cur.id); } },
    ], { width: 220, title: t('项目') });
  };
  // 历史条目的菜单：一个项目只有这一条对话时，「删除」就是删掉整个创作（对话 + 工作区文件）
  const openChatMenu = (el: Element, e: Entry) => {
    const whole = chatCount(e.projectId) <= 1;
    openMenuAt(el, [
      { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: e.title }); if (name) renameHistoryChat(e.projectId, e.chatId, name); } },
      { label: whole ? t('删除创作') : t('删除对话'), danger: true, onClick: async () => {
        const ok = await confirmDialog(whole
          ? { title: t('删除创作'), body: `删除「${e.title}」这次创作？它的对话和工作区里的文件会一起删除，不可恢复。`, okLabel: '删除', danger: true }
          : { title: t('删除对话'), body: `删除对话「${e.title}」？工作区里的文件不受影响。`, okLabel: '删除', danger: true });
        if (!ok) return;
        if (whole) deleteCreation(e.projectId); else deleteHistoryChat(e.projectId, e.chatId);
      } },
    ], { width: 160, align: 'right' });
  };
  const openSettingsMenu = (el: Element) => openMenuAt(el, [
    { label: t('模型设置'), icon: <Settings size={14} />, hint: modelCfg()?.apiKey ? '已连接' : '未连接', onClick: openModelSettings },
    { label: `${t('语言')} · ${lang === 'zh' ? '中文' : 'English'}`, icon: <Languages size={14} />, onClick: toggleLang },
  ], { width: 220 });

  const collapsed = ui.sidebarCollapsed;
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="导航">
      <div className="sb-head">
        <button type="button" className="sb-logo" onClick={e => openProjectMenu(e.currentTarget)} title={projects.active().title}>
          <img src="./moodio-logo.svg" alt="" /><span className="sb-brand">Moodio</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => setUi({ sidebarCollapsed: !collapsed })} aria-label={collapsed ? '展开侧栏' : '收起侧栏'} title={collapsed ? '展开侧栏' : '收起侧栏'}><PanelLeft size={18} /></button>
      </div>
      {!collapsed && (
        <button type="button" className="sb-project" onClick={e => openProjectMenu(e.currentTarget)}>
          <span className="sb-project-name project-title">{projects.active().title}</span><ChevronDown size={14} />
        </button>
      )}
      <nav className="sb-nav" aria-label="板块">
        <button type="button" className={`sb-item${page === 'chat' && !chats.find(c => c.id === active)?.messages.length ? ' active' : ''}`} onClick={() => { go('chat'); startCreation(); }} title={t('创作')}><Sparkles size={18} /><span>{t('创作')}</span></button>
        {/* 资源 = 素材库页面：所有创作里生成 / 上传的图片与视频 */}
        <button type="button" className={`sb-item${page === 'library' ? ' active' : ''}`} onClick={() => go('library')} title={t('资源')}><FolderOpen size={18} /><span>{t('资源')}</span></button>
        <button type="button" className="sb-item" onClick={openBrief} title={t('创作纲领')}><Compass size={18} /><span>{t('创作纲领')}</span></button>
      </nav>
      {!collapsed && (
        <div className="sb-history">
          <div className="sb-history-head"><span>{t('创作历史')}</span></div>
          <div className="sb-history-list">
            {(['今天', '昨天', '更早'] as const).map(g => groups[g].length ? (
              <div key={g} className="sb-group">
                <div className="sb-group-title">{t(g)}</div>
                {groups[g].map(e => {
                  const isActive = e.current && e.chatId === active;
                  return (
                    <div key={e.projectId + ':' + e.chatId} className={`sb-chat${isActive ? ' active' : ''}`}>
                      <button type="button" className="sb-chat-main" title={e.current ? e.title : `${e.title} · ${e.projectTitle}`} onClick={() => {
                        if (isActive) return;
                        if (busy) { toast('请先停止当前 Agent 任务，再切换创作。'); return; }
                        go('chat');
                        if (e.current) setActive(e.chatId); else switchProject(e.projectId, e.chatId);
                      }}>
                        <span className="sb-chat-icon"><FileText size={16} /></span><span className="sb-chat-title">{e.title}</span>
                      </button>
                      <button type="button" className="sb-chat-more" aria-label="更多" onClick={ev => openChatMenu(ev.currentTarget, e)}><MoreHorizontal size={16} /></button>
                    </div>
                  );
                })}
              </div>
            ) : null)}
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
