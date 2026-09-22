// ===== 素材库页面：所有创作里生成 / 上传的图片与视频（布局参考小云雀的素材库：顶部标签 + 搜索，工具行视图 / 来源 / 筛选 / 排序 / 尺寸，网格卡片，点开大图）=====
import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, MoreHorizontal, Download, X, ExternalLink, Image as ImageIcon, Film, Music } from 'lucide-react';
import { useFiles } from '../lib/store';
import { projects } from '../lib/projects';
import { allMedia, renameLibraryMedia, deleteLibraryMedia, restoreLibraryMedia, openInCreation } from '../lib/library';
import type { LibraryItem } from '../lib/library';
import { mediaUrl, getBlob, downloadBlob } from '../lib/storage';
import { timeAgo, formatBytes } from '../lib/time';
import { openMenuAt } from './Menu';
import { confirmDialog, promptDialog } from './Dialogs';
import { toast } from './Toast';
import { useT } from '../lib/i18n';

type Tab = 'all' | 'assets'; type View = 'grid' | 'list'; type Source = 'agent' | 'user' | null;
type Kind = 'all' | 'image' | 'video' | 'audio'; type Sort = 'newest' | 'oldest' | 'name'; type Size = 's' | 'm' | 'l';
const PREFS_KEY = 'moodio-library-prefs';
const GROUPS = ['人物', '场景', '产品', '道具', '其他'];
function loadPrefs(): { view: View; size: Size } {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); return { view: p.view === 'list' ? 'list' : 'grid', size: ['s', 'm', 'l'].includes(p.size) ? p.size : 'm' }; } catch { return { view: 'grid', size: 'm' }; }
}
function useMediaUrl(id: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let alive = true; mediaUrl(id).then(u => { if (alive) setUrl(u); }); return () => { alive = false; }; }, [id]);
  return url;
}
function fmtDuration(sec: number) {
  if (!isFinite(sec) || sec <= 0) return ''; const s = Math.round(sec);
  return s >= 60 ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}

function Thumb({ item, onDuration }: { item: LibraryItem; onDuration?: (d: number) => void }) {
  const url = useMediaUrl(item.id);
  if (item.kind === 'audio') return <span className="lib-thumb-empty"><Music size={28} />{url && <audio src={url} preload="metadata" onLoadedMetadata={e => onDuration?.(e.currentTarget.duration)} />}</span>;
  if (!url) return <span className="lib-thumb-empty">{item.kind === 'image' ? <ImageIcon size={26} /> : <Film size={26} />}</span>;
  return item.kind === 'image' ? <img src={url} alt="" loading="lazy" /> : <video src={url} muted preload="metadata" onLoadedMetadata={e => onDuration?.(e.currentTarget.duration)} />;
}

function Card({ item, view, onOpen, onMenu }: { item: LibraryItem; view: View; onOpen: () => void; onMenu: (el: Element) => void }) {
  const [dur, setDur] = useState(0);
  const menuBtn = (cls: string) => <button type="button" className={cls} aria-label="更多" onClick={e => { e.stopPropagation(); onMenu(e.currentTarget); }}><MoreHorizontal size={16} /></button>;
  if (view === 'list') return (
    <div className="file-row" onClick={onOpen} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }}>
      <span className="row-thumb"><Thumb item={item} onDuration={setDur} /></span>
      <span className="row-name">{item.name}</span>
      <span className="row-meta">{[item.kind !== 'image' && dur ? fmtDuration(dur) : '', item.projectTitle, formatBytes(item.size)].filter(Boolean).join(' · ')}</span>
      <span className="row-time">{timeAgo(item.createdAt)}</span>
      {menuBtn('row-more')}
    </div>
  );
  return (
    <div className="lib-card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={e => { if (e.key === 'Enter') onOpen(); }} onContextMenu={e => { e.preventDefault(); onMenu(e.currentTarget); }}>
      <div className="lib-thumb">
        <Thumb item={item} onDuration={setDur} />
        {item.kind !== 'image' && dur > 0 && <span className="lib-dur">{fmtDuration(dur)}</span>}
      </div>
      <div className="lib-name" title={`${item.name} · ${item.projectTitle}`}>{item.name}</div>
      {menuBtn('card-more')}
    </div>
  );
}

function Preview({ item, onClose, onMenu }: { item: LibraryItem; onClose: () => void; onMenu: (el: Element) => void }) {
  const t = useT(); const url = useMediaUrl(item.id);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  const meta = [item.width ? `${item.width}×${item.height}` : '', formatBytes(item.size), item.model || '', item.projectTitle, timeAgo(item.createdAt)].filter(Boolean).join(' · ');
  return (
    <div className="lib-preview" role="dialog" aria-label={item.name}>
      <header className="lib-preview-head">
        <span className="name" title={item.name}>{item.name}</span>
        <span className="meta">{meta}</span>
        <button type="button" className="pill" onClick={() => { onClose(); openInCreation(item.projectId, item.id); }}><ExternalLink size={14} />{t('打开所在创作')}</button>
        <button type="button" className="icon-btn" aria-label={t('下载')} title={t('下载')} onClick={async () => { const b = await getBlob(item.id); if (b) downloadBlob(item.name, b); }}><Download size={18} /></button>
        <button type="button" className="icon-btn" aria-label="更多" onClick={e => onMenu(e.currentTarget)}><MoreHorizontal size={18} /></button>
        <button type="button" className="icon-btn" aria-label={t('关闭')} title={t('关闭')} onClick={onClose}><X size={20} /></button>
      </header>
      <div className="lib-preview-body" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        {url ? (item.kind === 'image' ? <img src={url} alt={item.name} /> : item.kind === 'audio' ? <div className="audio-player dark"><Music size={48} /><audio src={url} controls autoPlay /></div> : <video src={url} controls autoPlay />) : null}
      </div>
    </div>
  );
}

export default function Library() {
  const t = useT();
  const activeMedia = useFiles(s => s.media);
  const [version, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump(x => x + 1); const names = ['moodio:project-changed', 'moodio:library-changed'];
    names.forEach(n => window.addEventListener(n, fn)); const un = projects.subscribe(fn);
    return () => { names.forEach(n => window.removeEventListener(n, fn)); un(); };
  }, []);
  const items = useMemo(() => allMedia(), [activeMedia, version]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [prefs, setPrefs] = useState(loadPrefs);
  const [source, setSource] = useState<Source>(null);
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const savePrefs = (p: { view: View; size: Size }) => { setPrefs(p); try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ } };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = items.filter(m => (!source || (source === 'agent' ? m.by === 'agent' : m.by !== 'agent')) && (kind === 'all' || m.kind === kind) && (!needle || m.name.toLowerCase().includes(needle) || m.projectTitle.toLowerCase().includes(needle)));
    return list.sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'zh') : sort === 'oldest' ? (a, b) => a.createdAt - b.createdAt : (a, b) => b.createdAt - a.createdAt);
  }, [items, q, source, kind, sort]);
  const keyOf = (m: LibraryItem) => m.projectId + ':' + m.id;
  const preview = previewKey ? items.find(m => keyOf(m) === previewKey) || null : null;   // 改名后仍指向同一条；删掉了就自动关闭

  const menu = (el: Element, m: LibraryItem) => openMenuAt(el, [
    { label: t('打开所在创作'), onClick: () => { setPreviewKey(null); openInCreation(m.projectId, m.id); } },
    { label: t('下载'), onClick: async () => { const b = await getBlob(m.id); if (b) downloadBlob(m.name, b); } },
    { label: t('重命名'), onClick: async () => { const name = await promptDialog({ title: t('重命名'), value: m.name }); if (name) renameLibraryMedia(m.projectId, m.id, name); } },
    { label: t('删除'), danger: true, onClick: async () => {
      if (!await confirmDialog({ title: t('删除文件'), body: `删除「${m.name}」？7 天内可撤销。`, okLabel: '删除', danger: true })) return;
      const entry = deleteLibraryMedia(m.projectId, m.id); setPreviewKey(null);
      toast(`已删除「${m.name}」`, entry ? { label: '撤销', onClick: () => restoreLibraryMedia(m.projectId, entry.trashId) } : undefined);
    } },
  ], { width: 180, align: 'right' });

  const drop = (el: Element, current: string, options: { label: string; value: string; onPick: () => void }[]) =>
    openMenuAt(el, options.map(o => ({ label: o.label, active: o.value === current, onClick: o.onPick })), { width: 170 });
  const viewLabel = prefs.view === 'grid' ? t('平铺视图') : t('列表视图');
  const kindLabel = kind === 'all' ? t('筛选') : kind === 'image' ? t('图片') : kind === 'video' ? t('视频') : t('音频');
  const sortLabel = sort === 'newest' ? t('排序') : sort === 'oldest' ? t('最早在前') : t('按名称');
  const sizeLabel = t('展示尺寸');
  const grid = (list: LibraryItem[]) => (
    <div className={prefs.view === 'grid' ? 'lib-grid' : 'file-list'}>{list.map(m => <Card key={keyOf(m)} item={m} view={prefs.view} onOpen={() => setPreviewKey(keyOf(m))} onMenu={el => menu(el, m)} />)}</div>
  );

  return (
    <section className="library" aria-label={t('素材库')}>
      <header className="lib-head">
        <div className="lib-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>{t('素材库')}</button>
          <button type="button" role="tab" aria-selected={tab === 'assets'} className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}>{t('资产库')}</button>
        </div>
        <label className="search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('搜索素材')} aria-label={t('搜索素材')} /></label>
      </header>
      <div className="lib-toolbar">
        <button type="button" className="lib-drop" onClick={e => drop(e.currentTarget, prefs.view, [{ label: t('平铺视图'), value: 'grid', onPick: () => savePrefs({ ...prefs, view: 'grid' }) }, { label: t('列表视图'), value: 'list', onPick: () => savePrefs({ ...prefs, view: 'list' }) }])}>{viewLabel}<ChevronDown size={14} /></button>
        <span className="sep" />
        <button type="button" className={`lib-chip${source === 'agent' ? ' active' : ''}`} onClick={() => setSource(source === 'agent' ? null : 'agent')}>{t('AI 生成')}</button>
        <button type="button" className={`lib-chip${source === 'user' ? ' active' : ''}`} onClick={() => setSource(source === 'user' ? null : 'user')}>{t('我上传的')}</button>
        <span className="spacer" />
        <button type="button" className="lib-drop" onClick={e => drop(e.currentTarget, kind, [{ label: t('全部'), value: 'all', onPick: () => setKind('all') }, { label: t('图片'), value: 'image', onPick: () => setKind('image') }, { label: t('视频'), value: 'video', onPick: () => setKind('video') }, { label: t('音频'), value: 'audio', onPick: () => setKind('audio') }])}>{kindLabel}<ChevronDown size={14} /></button>
        <button type="button" className="lib-drop" onClick={e => drop(e.currentTarget, sort, [{ label: t('最新在前'), value: 'newest', onPick: () => setSort('newest') }, { label: t('最早在前'), value: 'oldest', onPick: () => setSort('oldest') }, { label: t('按名称'), value: 'name', onPick: () => setSort('name') }])}>{sortLabel}<ChevronDown size={14} /></button>
        <button type="button" className="lib-drop" onClick={e => drop(e.currentTarget, prefs.size, [{ label: t('小'), value: 's', onPick: () => savePrefs({ ...prefs, size: 's' }) }, { label: t('中'), value: 'm', onPick: () => savePrefs({ ...prefs, size: 'm' }) }, { label: t('大'), value: 'l', onPick: () => savePrefs({ ...prefs, size: 'l' }) }])}>{sizeLabel}<ChevronDown size={14} /></button>
      </div>
      <div className="lib-body" data-size={prefs.size}>
        {tab === 'all' ? grid(shown) : GROUPS.map(g => {
          const list = shown.filter(m => (GROUPS.includes(m.group) ? m.group : '其他') === g);
          return list.length ? <section key={g} className="lib-section"><h3>{t(g)}<small>{list.length}</small></h3>{grid(list)}</section> : null;
        })}
      </div>
      {preview && <Preview item={preview} onClose={() => setPreviewKey(null)} onMenu={el => menu(el, preview)} />}
    </section>
  );
}
