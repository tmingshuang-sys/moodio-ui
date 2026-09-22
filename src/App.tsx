// ===== 布局：左侧导航 | 对话 | 右侧文件工作区（可拖拽分栏，关掉后右缘留一个把手）=====
import { useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatPane from './components/ChatPane';
import ResourcePane, { PaneHandle } from './components/ResourcePane';
import { ToastHost } from './components/Toast';
import { MenuHost } from './components/Menu';
import { DialogHost } from './components/Dialogs';
import AgentLive from './components/AgentLive';
import { useFiles } from './lib/store';
import { useLang } from './lib/i18n';

const MIN_CHAT = 380, MIN_PANE = 420;

export default function App() {
  const ui = useFiles(s => s.ui);
  const setUi = useFiles(s => s.setUi);
  const fileCount = useFiles(s => s.docs.length + s.media.length);
  const paneOpen = ui.paneOpen && fileCount > 0;   // 一个文件都没有时工作区不展开；Agent 生成或上传后 openInPane() 会打开
  const lang = useLang(s => s.lang);
  const mainRef = useRef<HTMLDivElement>(null);
  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; }, [lang]);

  const paneWidth = useCallback((total: number) => {
    const wanted = ui.paneWidth || Math.round(total * 0.56);
    return Math.max(MIN_PANE, Math.min(wanted, total - MIN_CHAT));
  }, [ui.paneWidth]);

  const onDividerDown = (e: React.PointerEvent) => {
    const main = mainRef.current; if (!main) return;
    e.preventDefault();
    const rect = main.getBoundingClientRect();
    const move = (ev: PointerEvent) => { const w = rect.right - ev.clientX; setUi({ paneWidth: Math.max(MIN_PANE, Math.min(w, rect.width - MIN_CHAT)) }); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.classList.remove('is-resizing'); };
    document.body.classList.add('is-resizing');
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };

  const total = mainRef.current?.getBoundingClientRect().width || Math.max(900, window.innerWidth - (ui.sidebarCollapsed ? 64 : 280));
  const width = paneWidth(total);

  return (
    <div className={`app${ui.sidebarCollapsed ? ' sidebar-collapsed' : ''}${paneOpen ? ' pane-open' : ''}`}>
      <Sidebar />
      <main className="main" ref={mainRef}>
        <ChatPane />
        {paneOpen && (
          <>
            <div className="divider" onPointerDown={onDividerDown} role="separator" aria-orientation="vertical" aria-label="调整工作区宽度" />
            <ResourcePane width={width} />
          </>
        )}
        {!paneOpen && fileCount > 0 && <PaneHandle />}
      </main>
      <AgentLive />
      <ToastHost />
      <MenuHost />
      <DialogHost />
    </div>
  );
}
