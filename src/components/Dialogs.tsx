// ===== 弹窗：确认 / 输入 / 模型设置 / 创作纲领。宽 620、圆角 12、标题栏 18/22 + 右上 ×、正文 20/22、底栏按钮靠右 =====
import { useEffect, useState } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';
import { create } from 'zustand';
import { X, FolderOpen } from 'lucide-react';
import { useFiles } from '../lib/store';
import { BRIEF_FIELDS, BRIEF_FORMATS } from '../lib/guides';
import { modelCfg, saveModelCfg, modelProvider, PROVIDER_DEFAULTS, probeModel, explainModelError } from '../lib/model';
import { MEDIA_DEFAULTS, mediaEndpoint } from '../lib/mediagen';
import type { ModelConfig } from '../lib/types';
import { toast } from './Toast';
import { pathFromDrop } from '../lib/nle';

type DialogSpec =
  | { kind: 'confirm'; title: string; body: ReactNode; okLabel?: string; danger?: boolean; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; title: string; label?: string; value: string; placeholder?: string; okLabel?: string; resolve: (v: string | null) => void }
  | { kind: 'folder'; title: string; hint: ReactNode; resolve: (v: { handle: FileSystemDirectoryHandle | null; path: string } | null) => void }
  | { kind: 'model' }
  | { kind: 'brief' };
interface DialogState { dialog: DialogSpec | null; open: (d: DialogSpec) => void; close: () => void; }
const useDialog = create<DialogState>(set => ({ dialog: null, open: d => set({ dialog: d }), close: () => set({ dialog: null }) }));

export function confirmDialog(opts: { title: string; body: ReactNode; okLabel?: string; danger?: boolean }): Promise<boolean> {
  return new Promise(resolve => useDialog.getState().open({ kind: 'confirm', ...opts, resolve }));
}
export function promptDialog(opts: { title: string; label?: string; value?: string; placeholder?: string; okLabel?: string }): Promise<string | null> {
  return new Promise(resolve => useDialog.getState().open({ kind: 'prompt', title: opts.title, label: opts.label, value: opts.value || '', placeholder: opts.placeholder, okLabel: opts.okLabel, resolve }));
}
// 选导出文件夹：把文件夹从访达拖进来，一步同时拿到写入权限（FileSystemDirectoryHandle）与绝对路径（拖放的 text/uri-list）
export function folderDialog(opts: { title: string; hint: ReactNode }): Promise<{ handle: FileSystemDirectoryHandle | null; path: string } | null> {
  return new Promise(resolve => useDialog.getState().open({ kind: 'folder', title: opts.title, hint: opts.hint, resolve }));
}
export const openModelSettings = () => useDialog.getState().open({ kind: 'model' });
export const openBrief = () => useDialog.getState().open({ kind: 'brief' });

function Frame({ title, children, footer, onClose }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey); }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
        <div className="dialog-body">{children}</div>
        <footer>{footer}</footer>
      </section>
    </div>
  );
}

function ConfirmDialog({ d }: { d: Extract<DialogSpec, { kind: 'confirm' }> }) {
  const close = useDialog(s => s.close);
  const done = (ok: boolean) => { close(); d.resolve(ok); };
  return <Frame title={d.title} onClose={() => done(false)} footer={<><button type="button" className="btn" onClick={() => done(false)}>取消</button><button type="button" className={`btn primary${d.danger ? ' danger' : ''}`} onClick={() => done(true)}>{d.okLabel || '确定'}</button></>}>{typeof d.body === 'string' ? <p>{d.body}</p> : d.body}</Frame>;
}

function PromptDialog({ d }: { d: Extract<DialogSpec, { kind: 'prompt' }> }) {
  const close = useDialog(s => s.close); const [value, setValue] = useState(d.value);
  const done = (v: string | null) => { close(); d.resolve(v); };
  return (
    <Frame title={d.title} onClose={() => done(null)} footer={<><button type="button" className="btn" onClick={() => done(null)}>取消</button><button type="button" className="btn primary" onClick={() => done(value.trim())} disabled={!value.trim()}>{d.okLabel || '确定'}</button></>}>
      <label>{d.label || ''}<input autoFocus value={value} placeholder={d.placeholder} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && value.trim()) done(value.trim()); }} /></label>
    </Frame>
  );
}

function FolderDialog({ d }: { d: Extract<DialogSpec, { kind: 'folder' }> }) {
  const close = useDialog(s => s.close);
  const [path, setPath] = useState(''); const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [over, setOver] = useState(false); const [note, setNote] = useState('');
  const done = (v: { handle: FileSystemDirectoryHandle | null; path: string } | null) => { close(); d.resolve(v); };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const p = pathFromDrop(e.dataTransfer); if (p) setPath(p);
    const item = e.dataTransfer.items?.[0] as any;
    if (item?.getAsFileSystemHandle) {
      try {
        const h = await item.getAsFileSystemHandle();
        if (h?.kind === 'directory') {
          const perm = await (h as any).requestPermission?.({ mode: 'readwrite' }).catch(() => 'denied');
          if (perm === 'granted') { setHandle(h); setNote(p ? '' : '拿到了写入权限，但没读出路径，可以手动粘贴'); }
          else setNote('需要允许写入这个文件夹才能把片段放进去');
        } else setNote('请拖一个文件夹，不是文件');
      } catch { setNote('这个浏览器不支持拖文件夹，请用下面的按钮选择'); }
    }
  };
  const pick = async () => {
    try { const h = await (window as any).showDirectoryPicker({ id: 'moodio-export', mode: 'readwrite', startIn: 'videos' }); setHandle(h); setNote(path ? '' : '已选好文件夹，还差路径：把它从访达拖进来，或粘贴路径'); }
    catch { /* 用户取消 */ }
  };
  return (
    <Frame title={d.title} onClose={() => done(null)} footer={<><button type="button" className="btn" onClick={() => done(null)}>取消</button><button type="button" className="btn primary" disabled={!handle} onClick={() => done({ handle, path: path.trim() })}>完成</button></>}>
      <div className="folder-pick">
        <div className="hint">{d.hint}</div>
        <div className={`drop-zone${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
          <FolderOpen size={22} />
          <strong>把文件夹从访达拖到这里</strong>
          <span>一步搞定：同时拿到存放位置和路径，不用手填</span>
          <button type="button" className="btn" onClick={pick}>或者点这里选文件夹</button>
        </div>
        <label>路径<input value={path} placeholder="/Users/你的用户名/Movies/片段" onChange={e => setPath(e.target.value)} /></label>
        <p className="state">{handle ? `✓ 已授权文件夹「${handle.name}」` : '还没选文件夹'}{path ? `　✓ 路径已识别` : '　路径留空则不生成工程文件'}{note ? `　${note}` : ''}</p>
      </div>
    </Frame>
  );
}

function ModelDialog() {
  const close = useDialog(s => s.close);
  const [cfg, setCfg] = useState<ModelConfig>(() => { const c = modelCfg() || {}; const prov = modelProvider(c); return { provider: prov, baseUrl: c.baseUrl || PROVIDER_DEFAULTS[prov].baseUrl, apiKey: c.apiKey || '', model: c.model || (prov === 'openai' ? 'auto' : PROVIDER_DEFAULTS[prov].model), thinking: c.thinking || '', writerModel: c.writerModel || '', writerThinking: c.writerThinking || '', visionModel: c.visionModel || '', mediaBaseUrl: c.mediaBaseUrl || '', mediaToken: c.mediaToken || '', imageModel: c.imageModel || '', videoModel: c.videoModel || '', videoImageModel: c.videoImageModel || '' }; });
  const [test, setTest] = useState<{ state: 'pending' | 'ok' | 'fail'; text: string } | null>(null);
  const prov = cfg.provider || 'openai'; const pd = PROVIDER_DEFAULTS[prov];
  const setProvider = (p: 'claude' | 'openai') => { const other = PROVIDER_DEFAULTS[p === 'claude' ? 'openai' : 'claude']; const next = { ...cfg, provider: p }; if (!cfg.baseUrl || cfg.baseUrl === other.baseUrl) next.baseUrl = PROVIDER_DEFAULTS[p].baseUrl; if (!cfg.model || cfg.model === other.model) next.model = PROVIDER_DEFAULTS[p].model; setCfg(next); };
  const runTest = async () => {
    if (!cfg.apiKey?.trim()) { setTest({ state: 'fail', text: '请先填写 API Key。' }); return; }
    setTest({ state: 'pending', text: `正在连接 ${cfg.baseUrl || pd.baseUrl} …` }); const t0 = Date.now();
    try { const r = await probeModel(cfg); setTest({ state: 'ok', text: `连接成功（${Date.now() - t0} ms）。模型回复：${r}` }); }
    catch (e) { setTest({ state: 'fail', text: '连接失败：' + explainModelError(e).message }); }
  };
  const save = () => { saveModelCfg({ ...modelCfg(), ...cfg, baseUrl: cfg.baseUrl?.trim(), apiKey: cfg.apiKey?.trim(), model: cfg.model?.trim(), writerModel: cfg.writerModel?.trim(), visionModel: cfg.visionModel?.trim(), mediaBaseUrl: cfg.mediaBaseUrl?.trim(), mediaToken: cfg.mediaToken?.trim() }); close(); toast('模型设置已保存'); };
  const mediaOn = !!mediaEndpoint(cfg);
  return (
    <Frame title="Agent 模型设置" onClose={close} footer={<><button type="button" className="btn" onClick={close}>取消</button><button type="button" className="btn" onClick={runTest} disabled={test?.state === 'pending'}>测试连接</button>{modelCfg()?.apiKey && <button type="button" className="btn" onClick={() => { saveModelCfg(null); close(); toast('已断开模型'); }}>断开</button>}<button type="button" className="btn primary" onClick={save}>保存</button></>}>
      <p>对话与写作都用这里的模型。密钥仅保存在当前浏览器中。</p>
      <label>服务商<select value={prov} onChange={e => setProvider(e.target.value as 'claude' | 'openai')}><option value="claude">Claude（Anthropic）</option><option value="openai">Moodio 网关 / OpenAI 兼容</option></select></label>
      <label>Base URL<input value={cfg.baseUrl || ''} onChange={e => setCfg({ ...cfg, baseUrl: e.target.value })} /></label>
      <label>API Key<input type="password" value={cfg.apiKey || ''} placeholder={pd.placeholder} onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} /></label>
      <small className="note">用 Moodio 网关时，这里填部署网关时设定的「访问口令」，不是 DeepSeek 等服务商的 API Key；只有 Base URL 直连服务商时才填它的 Key。</small>
      <label>模型<input value={cfg.model || ''} placeholder="auto / deepseek-flash / kimi-k3" onChange={e => setCfg({ ...cfg, model: e.target.value })} /></label>
      <small className="note">auto = 智能匹配（规划用 DeepSeek Flash、写作用 DeepSeek V4 Pro、看图用 Kimi K3，不可用时自动换）；也可在输入框下方的模型面板「推理模型」里选。走 Moodio 网关时按模型名分流：kimi-* 走 Moonshot，deepseek-* 走 DeepSeek。</small>
      <label>思考模式<select value={cfg.thinking || ''} onChange={e => setCfg({ ...cfg, thinking: e.target.value })}><option value="">跟随模型默认（不发送参数）</option><option value="off">关闭</option><option value="low">开启 · low</option><option value="high">开启 · high</option><option value="max">开启 · max</option></select></label>
      <label>写作模型（可选）<input value={cfg.writerModel || ''} placeholder="例如 deepseek-v4-pro（留空同上）" onChange={e => setCfg({ ...cfg, writerModel: e.target.value })} /></label>
      <label>写作思考模式<select value={cfg.writerThinking || ''} onChange={e => setCfg({ ...cfg, writerThinking: e.target.value })}><option value="">同上</option><option value="off">关闭</option><option value="low">开启 · low</option><option value="high">开启 · high</option><option value="max">开启 · max</option></select></label>
      <small className="note">写剧本、分镜、提示词等创意请求和自审改用写作模型，留空则沿用上面的模型。思考模式对 DeepSeek 等支持 thinking 参数的 OpenAI 兼容服务生效；Claude 会自动开启思考并返回摘要。</small>
      <label>视觉模型（可选）<input value={cfg.visionModel || ''} placeholder="例如 kimi-k3（留空：主模型支持看图时直接用主模型）" onChange={e => setCfg({ ...cfg, visionModel: e.target.value })} /></label>
      <small className="note">参考图生成后自动用它逐张质检，Agent 也能按需看图。DeepSeek 不支持图片输入，配 kimi-k3 即可。</small>
      {test && <p className={`model-test ${test.state}`}>{test.text}</p>}
      <h3 className="dialog-section">图片 / 视频生成</h3>
      <p>经 Moodio 网关调用 fal.ai；真实的 fal key 存在网关的 Worker 密钥里，页面只带访问口令。留空则沿用上面的网关地址与 API Key。{mediaOn ? '' : ' 当前还不可用。'}</p>
      <label>网关地址<input value={cfg.mediaBaseUrl || ''} placeholder={MEDIA_DEFAULTS.baseUrl} onChange={e => setCfg({ ...cfg, mediaBaseUrl: e.target.value })} /></label>
      <label>访问口令<input type="password" value={cfg.mediaToken || ''} placeholder="留空 = 同上面的 API Key" onChange={e => setCfg({ ...cfg, mediaToken: e.target.value })} /></label>
      <small className="note">具体用哪个图片 / 视频模型、画面比例和时长，在输入框下方的模型按钮里选，那里能看到每个模型的特点。</small>
    </Frame>
  );
}

function BriefDialog() {
  const close = useDialog(s => s.close);
  const brief = useFiles(s => s.brief); const setBrief = useFiles(s => s.setBrief);
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(BRIEF_FIELDS.map(([k]) => [k, String((brief as any)[k] || '')])));
  const placeholders: Record<string, string> = { duration: '例如：每集 12 分钟 / 90 分钟 / 15 秒', platform: '例如：抖音竖屏 / 院线 / 电视台', audience: '例如：18–30 岁女性', tone: '例如：轻喜剧 + 悬疑，节奏快', references: '例如：《爱情神话》《去有风的地方》', visualStyle: '例如：冷色调、手持、夜景为主', taboos: '例如：不出现血腥、不涉及宗教', notes: '其他要求' };
  return (
    <Frame title="创作纲领" onClose={close} footer={<><button type="button" className="btn" onClick={close}>取消</button><button type="button" className="btn primary" onClick={() => { setBrief(form); close(); toast('创作纲领已保存'); }}>保存</button></>}>
      <p>这份纲领会附在 Agent 的每次请求里，它写剧本、拆分镜、生成提示词都以此为准。填得越具体，追问越少。</p>
      {BRIEF_FIELDS.map(([k, label]) => (
        <label key={k}>{label}
          {k === 'format' ? <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}><option value="">未定</option>{Object.entries(BRIEF_FORMATS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
            : k === 'notes' ? <textarea rows={3} value={form[k]} placeholder={placeholders[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              : <input value={form[k]} placeholder={placeholders[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />}
        </label>
      ))}
    </Frame>
  );
}

export function DialogHost() {
  const d = useDialog(s => s.dialog);
  if (!d) return null;
  if (d.kind === 'confirm') return <ConfirmDialog d={d} />;
  if (d.kind === 'prompt') return <PromptDialog d={d} />;
  if (d.kind === 'folder') return <FolderDialog d={d} />;
  if (d.kind === 'model') return <ModelDialog />;
  return <BriefDialog />;
}
