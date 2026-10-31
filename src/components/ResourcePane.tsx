// ===== 右侧文件工作区：文稿 / 图片 / 视频分区（网格或列表、搜索），点开文稿看 Markdown 预览或编辑，点开图片视频看大图 =====
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LayoutGrid, List, Search, X, ChevronLeft, ChevronRight, Download, MoreHorizontal, FileText, Image as ImageIcon, Film, Music, Pencil, Eye, Clapperboard, Maximize2, Minimize2 } from 'lucide-react';
import { exportToJianying, canWriteDirectly, hasExportDir, rememberExportDir, basePath, setBasePath, basePathOk, collectClipIds } from '../lib/jianying';
import { pingHelper, sendToResolve, HELPER_FILE } from '../lib/helper';
import { projects } from '../lib/projects';
// 导出片段到剪辑软件。装了本地助手（helper/moodio-helper.py）就真一键：片段传给它，它生成工程并让达芬奇打开排好的时间线；
// 没装就退回导出片段文件夹（网页自己既启动不了达芬奇，也拿不到本机绝对路径）
export async function runJianyingExport(mediaId?: string) {
  try {
    const helper = await pingHelper();
    if (helper.ok && helper.resolveInstalled) {
      const ids = collectClipIds(mediaId); if (!ids.length) throw new Error('没有可导出的片段');
      const title = projects.active().title || '成片';
      const recipe = mediaId ? useFiles.getState().media.find(m => m.id === mediaId)?.compose : undefined;
      toast(`正在把 ${ids.length} 段片段送进达芬奇…`);
      const r = await sendToResolve(ids, title, text => toast(text), recipe);
      toast(r.message);
      return;
    }
    // 第一次：把文件夹从访达拖进来，一步同时拿到写入权限与绝对路径（FCPXML 的媒体引用必须是绝对路径）
    if (canWriteDirectly() && (!(await hasExportDir()) || !basePath())) {
      const ok = await folderDialog({ title: t('片段存到哪'), hint: (
        <>
          <p>{t('会把成片的每个片段按顺序导出成 clip_01、clip_02…，并附一份达芬奇 / Final Cut 能直接导入的工程文件，导入后时间线上已经排好。')}</p>
          <p>{t('想更省事：下载并运行本地助手，之后点这个按钮就直接在达芬奇里打开排好的时间线。')} <a href={HELPER_FILE} download>{t('下载助手')}</a></p>
        </>) });
      if (!ok) return;
      if (ok.handle) await rememberExportDir(ok.handle);
      if (ok.path && basePathOk(ok.path)) setBasePath(ok.path);   // 拖进来的就是存放片段的文件夹，导出时在它下面再建子文件夹
      if (!ok.handle) return;
    }
    const r = await exportToJianying(mediaId, text => toast(text));
    const where = r.mode === 'direct' ? `「${r.folder}」` : `「${r.folder}.zip」`;
    toast(r.project
      ? `已导出 ${r.clips} 段到${where}，在达芬奇里「文件 › 导入 › 时间线」选里面的 .fcpxml，时间线就是排好的`
      : `已导出 ${r.clips} 段到${where}，没有路径所以没生成工程文件，在剪辑软件里按 clip_01…的顺序拖即可`);
  } catch (e: any) { if (e?.name !== 'AbortError') toast(`导出失败：${e?.message || e}`); }
}
import type { Doc, MediaItem } from '../lib/types';
import { useAgent, useFiles } from '../lib/store';
import { previewLines, baseName, wordCount, plainText } from '../lib/markdown';
import { timeAgo } from '../lib/time';
import { mediaUrl, downloadText, getBlob, downloadBlob } from '../lib/storage';
import { importFiles } from '../lib/upload';
import { openMenuAt } from './Menu';
import { confirmDialog, promptDialog, folderDialog } from './Dialogs';
import { toast } from './Toast';
import { useT, t } from '../lib/i18n';
import LedgerView from './LedgerView';
import ScenePreview from './ScenePreview';
import { LEDGER_NAME } from '../lib/ledger';

function useMediaUrl(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; mediaUrl(id).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [id]);
  return url;
}

function DocCard({ doc, view, onOpen, onMenu }: { doc: Doc; view: 'grid' | 'list'; onOpen: () => void; onMenu: (el: Element) => void }) {
  const t = useT();
  const lines = useMemo(() => previewLines(doc, 7), [doc.content, doc.kind]);
  const writing = useAgent(s => s.writing?.docId === doc.id);
  if (view === 'list') return (
    <div className={`file-row${writing ? ' writing' : ''}`} onClick={onOpen} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }}>
      <span className="row-icon"><FileText size={16} /></span><span className="row-name">{doc.name}</span><span className="row-meta">{doc.kind.toUpperCase()} · {wordCount(doc.content)} 字</span><span className="row-time">{timeAgo(doc.updatedAt)}</span>
      <button type="button" className="row-more" aria-label="更多" onClick={e => { e.stopPropagation(); onMenu(e.currentTarget); }}><MoreHorizontal size={16} /></button>
    </div>
  );
  return (
    <div className={`file-card${writing ? ' writing' : ''}`} onClick={onOpen} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}>
      <div className="card-thumb doc">
        <span className={`kind-badge ${doc.kind}`}>{doc.kind.toUpperCase()}</span>
        <div className="doc-lines">{lines.length ? lines.map((l, i) => <p key={i} className={i === 0 ? 'lead' : ''}>{l}</p>) : <p className="empty">（空文稿）</p>}</div>
      </div>
      <div className="card-name" title={doc.name}>{doc.name}</div>
      <div className="card-meta">{t('文稿')} · {timeAgo(doc.updatedAt)}</div>
      <button type="button" className="card-more" aria-label="更多" onClick={e => { e.stopPropagation(); onMenu(e.currentTarget); }}><MoreHorizontal size={16} /></button>
    </div>
  );
}

function MediaCard({ item, view, onOpen, onMenu }: { item: MediaItem; view: 'grid' | 'list'; onOpen: () => void; onMenu: (el: Element) => void }) {
  const url = useMediaUrl(item.id);
  if (view === 'list') return (
    <div className="file-row" onClick={onOpen} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }}>
      <span className="row-icon">{item.kind === 'image' ? <ImageIcon size={16} /> : item.kind === 'audio' ? <Music size={16} /> : <Film size={16} />}</span><span className="row-name">{item.name}</span><span className="row-meta">{item.group}</span><span className="row-time">{timeAgo(item.createdAt)}</span>
      <button type="button" className="row-more" aria-label="更多" onClick={e => { e.stopPropagation(); onMenu(e.currentTarget); }}><MoreHorizontal size={16} /></button>
    </div>
  );
  return (
    <div className="file-card media" onClick={onOpen} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}>
      <div className="card-thumb">
        <span className="kind-badge png">{item.name.split('.').pop()?.toUpperCase().slice(0, 4) || (item.kind === 'image' ? 'IMG' : 'MP4')}</span>
        {item.kind === 'audio' ? <div className="thumb-audio"><Music size={28} /></div> : url ? (item.kind === 'image' ? <img src={url} alt="" loading="lazy" /> : <video src={url} muted preload="metadata" />) : <div className="thumb-empty" />}
      </div>
      <div className="card-name" title={item.name}>{item.name}</div>
      <div className="card-meta">{timeAgo(item.createdAt)}</div>
      <button type="button" className="card-more" aria-label="更多" onClick={e => { e.stopPropagation(); onMenu(e.currentTarget); }}><MoreHorizontal size={16} /></button>
    </div>
  );
}

// 文稿视图：预览（Markdown 渲染）/ 编辑（自动保存）；Agent 写入时实时显示
export const SCENE_DOC_RE = /^画面-\d+\.json$/;   // 工作区里打开它时渲染成可播放的画面预览，而不是一堆 JSON
function DocView({ doc, onBack }: { doc: Doc; onBack: () => void }) {
  const t = useT();
  const updateDoc = useFiles(s => s.updateDoc);
  const writing = useAgent(s => (s.writing?.docId === doc.id ? s.writing : null));
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draft, setDraft] = useState(doc.content);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setDraft(doc.content); }, [doc.id]);
  useEffect(() => { if (writing) { setMode('preview'); const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; } }, [writing?.text]);
  useEffect(() => { if (mode !== 'edit' || draft === doc.content) return; const id = setTimeout(() => updateDoc(doc.id, { content: draft, by: 'user' }), 400); return () => clearTimeout(id); }, [draft, mode]);
  const text = writing ? writing.text : (mode === 'edit' ? draft : doc.content);
  return (
    <div className="doc-view">
      <header className="view-head">
        <button type="button" className="back-btn" onClick={onBack}><ChevronLeft size={16} />{t('资源')}</button>
        <span className={`kind-badge ${doc.kind}`}>{doc.kind.toUpperCase()}</span>
        <button type="button" className="view-title" title="点击重命名" onClick={async () => { const name = await promptDialog({ title: t('重命名'), value: doc.name }); if (name) useFiles.getState().renameDoc(doc.id, name); }}>{doc.name}</button>
        <span className="view-meta">{wordCount(text)} 字 · {timeAgo(doc.updatedAt)}</span>
        <div className="view-tools">
          {(doc.kind === 'md' || doc.name === LEDGER_NAME || SCENE_DOC_RE.test(doc.name)) && !writing && (
            <div className="seg" role="tablist"><button type="button" role="tab" aria-selected={mode === 'preview'} className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}><Eye size={14} />{t('预览')}</button><button type="button" role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}><Pencil size={14} />{t('编辑')}</button></div>
          )}
          <button type="button" className="icon-btn" aria-label={t('下载')} title={t('下载')} onClick={() => downloadText(doc.name, doc.content, doc.kind === 'json' ? 'application/json' : 'text/markdown')}><Download size={17} /></button>
          <button type="button" className="icon-btn" aria-label="更多" onClick={e => openMenuAt(e.currentTarget, [
            { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: doc.name }); if (name) useFiles.getState().renameDoc(doc.id, name); } },
            { label: t('删除'), danger: true, onClick: async () => { if (await confirmDialog({ title: '删除文稿', body: `删除「${doc.name}」？7 天内可从对话里撤销。`, okLabel: '删除', danger: true })) { const entry = useFiles.getState().removeDoc(doc.id); onBack(); toast(`已删除「${doc.name}」`, entry ? { label: '撤销', onClick: () => useFiles.getState().restoreTrash(entry.trashId) } : undefined); } } },
          ], { width: 160, align: 'right' })}><MoreHorizontal size={17} /></button>
        </div>
      </header>
      <div className={`view-body${writing ? ' writing' : ''}`} ref={bodyRef}>
        {mode === 'edit' && !writing ? (
          <textarea className="doc-editor" value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false} placeholder="在这里写 Markdown…" />
        ) : doc.name === LEDGER_NAME ? (
          <LedgerView doc={doc} />
        ) : SCENE_DOC_RE.test(doc.name) ? (
          <ScenePreview doc={doc} />
        ) : doc.kind === 'md' ? (
          <article className="md-body">{text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown> : <p className="md-empty">（空文稿，切到「编辑」开始写）</p>}{writing && <span className="stream-cursor block" aria-hidden="true" />}</article>
        ) : (
          <pre className="raw-body">{text}</pre>
        )}
      </div>
    </div>
  );
}

function MediaView({ item, onBack }: { item: MediaItem; onBack: () => void }) {
  const t = useT();
  const url = useMediaUrl(item.id);
  const groups = ['人物', '场景', '产品', '道具', '其他'];
  const bodyRef = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);   // 铺满窗口：浏览器不给原生全屏时的兜底
  useEffect(() => {
    if (!filled) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFilled(false); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [filled]);
  // 双击画面全屏。播放器自带的那个全屏按钮我们碰不到——浏览器把控件上的事件全吞了，页面一个都收不到；
  // 它在正常浏览器里本来就能用，只有嵌在应用里的预览窗会把全屏请求静默忽略，这时双击就是退路。
  const onVideoDoubleClick = async (e: React.MouseEvent<HTMLVideoElement>) => {
    if (filled) { setFilled(false); return; }
    const box = bodyRef.current || e.currentTarget;
    if (box.requestFullscreen) {
      try { await box.requestFullscreen(); if (document.fullscreenElement) return; } catch { /* 下面兜底 */ }
    }
    setFilled(true);
  };
  return (
    <div className="doc-view">
      <header className="view-head">
        <button type="button" className="back-btn" onClick={onBack}><ChevronLeft size={16} />{t('资源')}</button>
        <span className="kind-badge png">{item.kind === 'image' ? 'IMG' : item.kind === 'audio' ? 'AUDIO' : 'VIDEO'}</span>
        <button type="button" className="view-title" title="点击重命名" onClick={async () => { const name = await promptDialog({ title: t('重命名'), value: item.name }); if (name) useFiles.getState().updateMedia(item.id, { name }); }}>{item.name}</button>
        <div className="view-tools">
          <label className="group-select">{t('分区')}<select value={groups.includes(item.group) ? item.group : '其他'} onChange={e => useFiles.getState().updateMedia(item.id, { group: e.target.value })}>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
          {item.kind === 'video' && <button type="button" className="icon-btn" aria-label={t('导入到剪辑软件')} title={t('导入到剪辑软件')} onClick={() => void runJianyingExport(item.id)}><Clapperboard size={17} /></button>}
          <button type="button" className="icon-btn" aria-label={t('下载')} title={t('下载')} onClick={async () => { const blob = await getBlob(item.id); if (blob) downloadBlob(item.name, blob); }}><Download size={17} /></button>
          <button type="button" className="icon-btn" aria-label="更多" onClick={e => openMenuAt(e.currentTarget, [
            { label: t('删除'), danger: true, onClick: async () => { if (await confirmDialog({ title: '删除文件', body: `删除「${item.name}」？7 天内可撤销。`, okLabel: '删除', danger: true })) { const entry = useFiles.getState().removeMedia(item.id); onBack(); toast(`已删除「${item.name}」`, entry ? { label: '撤销', onClick: () => useFiles.getState().restoreTrash(entry.trashId) } : undefined); } } },
          ], { width: 160, align: 'right' })}><MoreHorizontal size={17} /></button>
        </div>
      </header>
      <div className={`view-body media-body${filled ? ' filled' : ''}`} ref={bodyRef}>
        {filled && <button type="button" className="fill-exit" onClick={() => setFilled(false)} title={t('退出全屏')}><Minimize2 size={16} />{t('退出全屏')}</button>}
        {url ? (item.kind === 'image' ? <img src={url} alt={item.name} /> : item.kind === 'audio' ? <div className="audio-player"><Music size={40} /><audio src={url} controls /></div> : <video src={url} controls playsInline onDoubleClick={onVideoDoubleClick} title={t('双击画面全屏')} />) : <p className="md-empty">文件不在本机媒体库里（可能在另一台设备上传）。</p>}
      </div>
    </div>
  );
}

export function PaneHandle() {
  const setUi = useFiles(s => s.setUi); const count = useFiles(s => s.docs.length + s.media.length);
  const t = useT();
  return <button type="button" className="pane-handle" onClick={() => setUi({ paneOpen: true })} aria-label={t('打开工作区')} title={t('打开工作区')}><ChevronLeft size={16} />{count > 0 && <em>{count}</em>}</button>;
}

export default function ResourcePane({ width }: { width: number }) {
  const t = useT();
  const docs = useFiles(s => s.docs); const media = useFiles(s => s.media);
  const ui = useFiles(s => s.ui); const setUi = useFiles(s => s.setUi); const openInPane = useFiles(s => s.openInPane);
  const [query, setQuery] = useState(''); const [imageGroup, setImageGroup] = useState('全部');
  const [dragging, setDragging] = useState(false);
  const q = query.trim().toLowerCase();
  const shownDocs = useMemo(() => docs.filter(d => !q || d.name.toLowerCase().includes(q) || plainText(d.content).toLowerCase().includes(q)).sort((a, b) => b.updatedAt - a.updatedAt), [docs, q]);
  const images = media.filter(m => m.kind === 'image' && (!q || m.name.toLowerCase().includes(q)));
  const videos = media.filter(m => m.kind === 'video' && (!q || m.name.toLowerCase().includes(q)));
  const audios = media.filter(m => m.kind === 'audio' && (!q || m.name.toLowerCase().includes(q)));
  const groupCounts = images.reduce<Record<string, number>>((acc, m) => { acc[m.group] = (acc[m.group] || 0) + 1; return acc; }, {});
  const shownImages = imageGroup === '全部' ? images : images.filter(m => m.group === imageGroup);
  const openDoc = docs.find(d => d.id === ui.openId); const openMedia = media.find(m => m.id === ui.openId);

  const docMenu = (el: Element, d: Doc) => openMenuAt(el, [
    { label: '打开', onClick: () => openInPane(d.id) },
    { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: d.name }); if (name) useFiles.getState().renameDoc(d.id, name); } },
    { label: t('下载'), onClick: () => downloadText(d.name, d.content, d.kind === 'json' ? 'application/json' : 'text/markdown') },
    { label: t('删除'), danger: true, onClick: async () => { if (await confirmDialog({ title: '删除文稿', body: `删除「${d.name}」？7 天内可撤销。`, okLabel: '删除', danger: true })) { const entry = useFiles.getState().removeDoc(d.id); toast(`已删除「${d.name}」`, entry ? { label: '撤销', onClick: () => useFiles.getState().restoreTrash(entry.trashId) } : undefined); } } },
  ], { width: 160, align: 'right' });
  const mediaMenu = (el: Element, m: MediaItem) => openMenuAt(el, [
    { label: '查看', onClick: () => openInPane(m.id) },
    { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: m.name }); if (name) useFiles.getState().updateMedia(m.id, { name }); } },
    { label: t('下载'), onClick: async () => { const blob = await getBlob(m.id); if (blob) downloadBlob(m.name, blob); } },
    { label: t('删除'), danger: true, onClick: async () => { if (await confirmDialog({ title: '删除文件', body: `删除「${m.name}」？7 天内可撤销。`, okLabel: '删除', danger: true })) { const entry = useFiles.getState().removeMedia(m.id); toast(`已删除「${m.name}」`, entry ? { label: '撤销', onClick: () => useFiles.getState().restoreTrash(entry.trashId) } : undefined); } } },
  ], { width: 160, align: 'right' });

  const onDrop = async (e: React.DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) await importFiles(e.dataTransfer.files); };

  return (
    <aside className={`pane${dragging ? ' dragging' : ''}`} style={{ width }} aria-label={t('资源')}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={onDrop}>
      {openDoc ? <DocView doc={openDoc} onBack={() => openInPane(null)} /> : openMedia ? <MediaView item={openMedia} onBack={() => openInPane(null)} /> : (
        <>
          <header className="pane-head">
            <h2>{t('资源')}</h2>
            <div className="seg" role="tablist" aria-label="视图">
              <button type="button" role="tab" aria-selected={ui.view === 'grid'} className={ui.view === 'grid' ? 'active' : ''} onClick={() => setUi({ view: 'grid' })} aria-label={t('网格')}><LayoutGrid size={16} /></button>
              <button type="button" role="tab" aria-selected={ui.view === 'list'} className={ui.view === 'list' ? 'active' : ''} onClick={() => setUi({ view: 'list' })} aria-label={t('列表')}><List size={16} /></button>
            </div>
            <label className="search"><Search size={15} /><input value={query} placeholder={t('查找…')} onChange={e => setQuery(e.target.value)} /></label>
            <button type="button" className="icon-btn" aria-label={t('关闭工作区')} title={t('关闭工作区')} onClick={() => setUi({ paneOpen: false })}><X size={18} /></button>
          </header>
          <div className="pane-body">
            {/* 有产物的分区才出现，不放空的占位框；搜索没结果时只给一行提示 */}
            {q && !shownDocs.length && !images.length && !videos.length && !audios.length && <p className="pane-empty">{t('没有找到匹配的文件')}</p>}
            {shownDocs.length > 0 && (
            <section className="pane-section">
              <h3>{t('文稿')}<small>共 {shownDocs.length} 个</small></h3>
              <div className={ui.view === 'grid' ? 'file-grid' : 'file-list'}>{shownDocs.map(d => <DocCard key={d.id} doc={d} view={ui.view} onOpen={() => openInPane(d.id)} onMenu={el => docMenu(el, d)} />)}</div>
            </section>
            )}
            {images.length > 0 && (
            <section className="pane-section">
              <h3>{t('图片')}<small>共 {images.length} 个</small></h3>
              {images.length > 0 && (
                <div className="chips">
                  <button type="button" className={imageGroup === '全部' ? 'active' : ''} onClick={() => setImageGroup('全部')}>{t('全部')} <b>{images.length}</b></button>
                  {Object.entries(groupCounts).map(([g, n]) => <button key={g} type="button" className={imageGroup === g ? 'active' : ''} onClick={() => setImageGroup(g)}>{t(g)} <b>{n}</b></button>)}
                </div>
              )}
              {shownImages.length > 0 && <div className={ui.view === 'grid' ? 'file-grid media' : 'file-list'}>{shownImages.map(m => <MediaCard key={m.id} item={m} view={ui.view} onOpen={() => openInPane(m.id)} onMenu={el => mediaMenu(el, m)} />)}</div>}
            </section>
            )}
            {videos.length > 0 && (
              <section className="pane-section">
                <h3>{t('视频')}<small>共 {videos.length} 个</small></h3>
                <div className={ui.view === 'grid' ? 'file-grid media' : 'file-list'}>{videos.map(m => <MediaCard key={m.id} item={m} view={ui.view} onOpen={() => openInPane(m.id)} onMenu={el => mediaMenu(el, m)} />)}</div>
              </section>
            )}
            {audios.length > 0 && (
              <section className="pane-section">
                <h3>{t('音频')}<small>共 {audios.length} 个</small></h3>
                <div className={ui.view === 'grid' ? 'file-grid media' : 'file-list'}>{audios.map(m => <MediaCard key={m.id} item={m} view={ui.view} onOpen={() => openInPane(m.id)} onMenu={el => mediaMenu(el, m)} />)}</div>
              </section>
            )}
          </div>
        </>
      )}
      {dragging && <div className="drop-overlay"><span>松开即可上传到媒体库</span></div>}
      <ChevronRight size={0} aria-hidden="true" />
    </aside>
  );
}
