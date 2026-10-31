// ===== 服务器设置：初始化账号、登录、填模型 key、看渲染任务 =====
// 做这个是为了不用再开终端。以前改一个 key 要 ssh 进去编辑 .env 再 systemctl restart，
// 现在填完即时生效（后端 5 秒缓存）。key 只往上送、不往下回——接口只回「配没配、什么时候改的」。
import { useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, Server, X } from 'lucide-react';
import { getSettings, listJobs, loginServer, logoutServer, probeServer, putSettings, serverToken, setServerToken, setupServer, whoami, type RenderJob, type ServerHealth, type SettingRow } from '../lib/server';
import { toast } from './Toast';

type Phase = 'probing' | 'none' | 'setup' | 'login' | 'ready';

export default function ServerDialog({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('probing');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [me, setMe] = useState<{ email: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 初始化 / 登录表单
  const [setupToken, setSetupToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 设置与任务
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [jobs, setJobs] = useState<RenderJob[]>([]);

  const refresh = async () => {
    const h = await probeServer();
    setHealth(h);
    if (!h) return setPhase('none');
    if (h.setup) return setPhase('setup');
    if (!serverToken()) return setPhase('login');
    try {
      const { user } = await whoami();
      setMe(user);
      setPhase('ready');
      await loadReady();
    } catch {
      setServerToken('');
      setPhase('login');
    }
  };
  const loadReady = async () => {
    try { setRows((await getSettings()).settings); } catch (e: any) { setErr(String(e.message)); }
    try { setJobs((await listJobs()).jobs); } catch { /* 没任务就算了 */ }
  };
  useEffect(() => { void refresh(); }, []);

  const doSetup = async () => {
    setBusy(true); setErr('');
    try {
      const r = await setupServer({ token: setupToken.trim(), email: email.trim(), password });
      setServerToken(r.token); setMe(r.user); setPassword('');
      toast('账号已创建');
      await refresh();
    } catch (e: any) { setErr(String(e.message)); } finally { setBusy(false); }
  };
  const doLogin = async () => {
    setBusy(true); setErr('');
    try {
      const r = await loginServer(email.trim(), password);
      setServerToken(r.token); setMe(r.user); setPassword('');
      await refresh();
    } catch (e: any) { setErr(String(e.message)); } finally { setBusy(false); }
  };
  const doSave = async () => {
    const patch = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== ''));
    if (!Object.keys(patch).length) return;
    setBusy(true); setErr('');
    try {
      const r = await putSettings(patch);
      setRows(r.settings); setEdits({});
      setHealth(await probeServer());
      toast(`已保存 ${r.changed.length} 项，立刻生效`);
    } catch (e: any) { setErr(String(e.message)); } finally { setBusy(false); }
  };

  const body = () => {
    if (phase === 'probing') return <p className="muted"><Loader2 size={14} className="spin" /> 正在探测后端…</p>;
    if (phase === 'none') return (
      <div className="sv-empty">
        <Server size={22} />
        <p><b>这个页面没有连着自建后端。</b></p>
        <p className="muted">服务端渲染、数据同步和服务器设置都要后端。本机开发（vite）下看到这个是正常的——
          把页面部署到服务器上（<code>server/deploy/setup.sh</code>）之后再打开这里。</p>
      </div>
    );
    if (phase === 'setup') return (
      <div className="sv-form">
        <p className="muted">这台后端还没有任何账号。用安装时打印的那串<b>一次性口令</b>创建第一个，口令用完即失效。</p>
        <label>一次性口令<input value={setupToken} onChange={e => setSetupToken(e.target.value)} placeholder="安装脚本最后打印的 32 位字符" autoFocus /></label>
        <label>邮箱<input value={email} onChange={e => setEmail(e.target.value)} placeholder="用来登录，不会发信" /></label>
        <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="至少 8 位" /></label>
      </div>
    );
    if (phase === 'login') return (
      <div className="sv-form">
        <label>邮箱<input value={email} onChange={e => setEmail(e.target.value)} autoFocus /></label>
        <label>密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void doLogin(); }} /></label>
      </div>
    );
    return (
      <div className="sv-ready">
        <div className="sv-status">
          <span className={health?.db ? 'ok' : 'bad'}>数据库 {health?.db ? '正常' : '未连接'}</span>
          <span className={health?.render ? 'ok' : 'bad'}>渲染 {health?.render ? '就绪' : '未安装'}</span>
          <span className="muted">存储 {health?.blobs === 'oss' ? 'OSS' : '本机磁盘'}</span>
          <span className="muted">{me?.email}</span>
        </div>

        <h3>模型 key</h3>
        <p className="muted">填完立刻生效，不用重启。留空表示不改；填一个空格再保存表示清掉它。
          已配置的不会回显——后端只告诉界面「配没配」，不回传值本身。</p>
        <div className="sv-keys">
          {rows.map(r => (
            <label key={r.key} className="sv-key">
              <span className="sv-key-head">
                {r.label}
                {r.set && <em className="ok"><Check size={12} />已配置{r.from === 'env' ? '（来自 .env）' : ''}</em>}
              </span>
              <input type="password" autoComplete="new-password" placeholder={r.set ? '已配置，填新值可覆盖' : r.hint}
                value={edits[r.key] ?? ''} onChange={e => setEdits({ ...edits, [r.key]: e.target.value })} />
              <small className="muted">{r.hint}</small>
            </label>
          ))}
        </div>

        <h3>渲染任务 <button type="button" className="icon-btn" onClick={() => void loadReady()} aria-label="刷新"><RefreshCw size={13} /></button></h3>
        {jobs.length === 0 ? <p className="muted">还没有服务端渲染过。</p> : (
          <ul className="sv-jobs">
            {jobs.slice(0, 8).map(j => (
              <li key={j.id} className={'st-' + j.status}>
                <b>{j.title}</b>
                <span>{j.status === 'running' ? `渲染中 ${Math.round(j.progress * 100)}%` : j.status === 'done' ? '完成' : j.status === 'failed' ? '失败' : j.status}</span>
                {j.error && <small title={j.error}>{j.error.slice(0, 70)}</small>}
                {j.status === 'done' && <a href={`/api/render/${j.id}/file`} target="_blank" rel="noreferrer">下载</a>}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const footer = () => {
    if (phase === 'setup') return <><button type="button" className="btn" onClick={onClose}>取消</button>
      <button type="button" className="btn primary" disabled={busy || !setupToken.trim() || !email.trim() || password.length < 8} onClick={() => void doSetup()}>创建账号</button></>;
    if (phase === 'login') return <><button type="button" className="btn" onClick={onClose}>取消</button>
      <button type="button" className="btn primary" disabled={busy || !email.trim() || !password} onClick={() => void doLogin()}>登录</button></>;
    if (phase === 'ready') return <>
      <button type="button" className="btn" onClick={() => void logoutServer().then(refresh)}>退出登录</button>
      <span style={{ flex: 1 }} />
      <button type="button" className="btn" onClick={onClose}>关闭</button>
      <button type="button" className="btn primary" disabled={busy || !Object.values(edits).some(v => v !== '')} onClick={() => void doSave()}>保存</button></>;
    return <button type="button" className="btn primary" onClick={onClose}>知道了</button>;
  };

  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="dialog sv-dialog" role="dialog" aria-modal="true" aria-label="服务器设置">
        <header><h2>服务器设置</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
        <div className="dialog-body">
          {err && <p className="sv-err">{err}</p>}
          {body()}
        </div>
        <footer>{footer()}</footer>
      </section>
    </div>
  );
}
