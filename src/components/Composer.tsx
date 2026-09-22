// ===== 输入框：+（上传 / 新建文档）、@ 引用文件、发送 / 停止；Enter 发送、Shift+Enter 换行 =====
import { useEffect, useRef, useState } from 'react';
import { Plus, AtSign, ArrowUp, Square, Image, FilePlus2, Film, FileText, Wand2, Clapperboard } from 'lucide-react';
import { useAgent, useFiles } from '../lib/store';
import { send, stopAgent } from '../lib/agent/runner';
import { openMenuAt } from './Menu';
import { pickFiles, uploadFiles } from '../lib/upload';
import { useT } from '../lib/i18n';
import { baseName } from '../lib/markdown';
import { toast } from './Toast';
import { promptDialog } from './Dialogs';
import { manualGenerate, mediaReadyReason, fallbackNote } from '../lib/mediagen';
import ModelPrefs from './ModelPrefs';

export default function Composer() {
  const t = useT();
  const busy = useAgent(s => s.busy);
  const docs = useFiles(s => s.docs); const media = useFiles(s => s.media);
  const addDoc = useFiles(s => s.addDoc); const openInPane = useFiles(s => s.openInPane);
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const focus = () => ref.current?.focus();
    const compose = (e: Event) => { const text = String((e as CustomEvent).detail || ''); setValue(v => (v ? v.replace(/\s+$/, '') + '\n' : '') + text); setTimeout(() => { const ta = ref.current; if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }, 0); };
    window.addEventListener('moodio:focus-composer', focus); window.addEventListener('moodio:compose', compose);
    return () => { window.removeEventListener('moodio:focus-composer', focus); window.removeEventListener('moodio:compose', compose); };
  }, []);
  useEffect(() => { const ta = ref.current; if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.min(220, Math.max(56, ta.scrollHeight)) + 'px'; }, [value]);

  const submit = () => { const text = value.trim(); if (!text || busy) return; setValue(''); void send(text); };
  const insert = (text: string) => { setValue(v => (v ? v.replace(/\s+$/, '') + ' ' : '') + text + ' '); ref.current?.focus(); };
  const plusMenu = (el: Element) => openMenuAt(el, [
    { label: t('上传图片 / 视频'), icon: <Image size={14} />, onClick: async () => { const files = await pickFiles(); if (files.length) { await uploadFiles(files); useFiles.getState().setUi({ paneOpen: true }); } } },
    { label: t('新建文档'), icon: <FilePlus2 size={14} />, onClick: () => { const doc = addDoc({ name: '未命名.md', content: '', by: 'user' }); openInPane(doc.id); toast('已新建文稿，可在右侧编辑'); } },
    { label: t('生成图片'), icon: <Wand2 size={14} />, onClick: () => void generate('image') },
    { label: t('生成视频'), icon: <Clapperboard size={14} />, onClick: () => void generate('video') },
  ], { width: 200 });
  // 手动生成：给一句画面描述就开始，进度显示在顶部状态胶囊上，完成后在工作区打开
  const generate = async (kind: 'image' | 'video') => {
    const reason = mediaReadyReason(); if (reason) { toast(reason); return; }
    const prompt = await promptDialog({ title: kind === 'image' ? t('生成图片') : t('生成视频'), label: '画面描述（建议用英文写具体）', placeholder: kind === 'image' ? 'Night, rain on a car windshield, neon reflections, cinematic' : 'Slow push in on a rainy car window at night, cinematic', okLabel: '开始生成' });
    if (!prompt) return;
    useFiles.getState().setUi({ paneOpen: true });
    try { const r = await manualGenerate(kind, { prompt }); toast(`已用 ${r.model.name} 生成「${r.item.name}」${fallbackNote(r)}`); }
    catch (e: any) { if (e?.name !== 'AbortError') toast('生成失败：' + (e?.message || e)); }
  };
  const atMenu = (el: Element) => {
    const items = [
      ...docs.slice(0, 12).map(d => ({ label: baseName(d.name), icon: <FileText size={14} />, hint: d.kind.toUpperCase(), onClick: () => insert('@' + d.name) })),
      ...media.slice(0, 8).map(m => ({ label: m.name, icon: m.kind === 'image' ? <Image size={14} /> : <Film size={14} />, hint: m.group, onClick: () => insert('@' + m.name) })),
    ];
    openMenuAt(el, items.length ? items : [{ label: '工作区里还没有文件', disabled: true }], { width: 280, title: t('引用文件') });
  };

  return (
    <div className="composer-wrap">
      <p className="composer-tip">{t('小技巧 输入 @ 引用工作区里的文稿或图片，助手会接着上次的思路创作')}</p>
      <div className="composer">
        <textarea ref={ref} value={value} rows={2} placeholder={t('与 Moodio Agent 对话，剧本、分镜、提示词都会生成到右侧工作区…')} aria-label="给 Agent 的消息"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } if (e.key === '@' ) { /* 光标处输入 @ 时弹出引用列表 */ setTimeout(() => { if (ref.current) atMenu(ref.current); }, 0); } }} />
        <div className="composer-tools">
          <button type="button" className="tool-btn" aria-label="添加" onClick={e => plusMenu(e.currentTarget)}><Plus size={18} /></button>
          <button type="button" className="tool-btn" aria-label={t('引用文件')} onClick={e => atMenu(e.currentTarget)}><AtSign size={17} /></button>
          <ModelPrefs />
          <span className="composer-spacer" />
          {busy ? <button type="button" className="send-btn stop" aria-label={t('停止')} onClick={stopAgent}><Square size={14} /></button>
            : <button type="button" className={`send-btn${value.trim() ? ' ready' : ''}`} aria-label={t('发送')} onClick={submit} disabled={!value.trim()}><ArrowUp size={18} /></button>}
        </div>
      </div>
      <p className="composer-foot">AI 可能会犯错，内容仅供参考，请核实重要信息</p>
    </div>
  );
}
