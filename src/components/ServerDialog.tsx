// ===== 服务器设置：初始化账号、登录 / 注册、设新密码、填模型 key、OSS、账号管理、看渲染任务 =====
// 做这个是为了不用再开终端。以前改一个 key 要 ssh 进去编辑 .env 再 systemctl restart，
// 现在填完即时生效（后端 5 秒缓存）。key 只往上送、不往下回——接口只回「配没配、什么时候改的」。
// 账号这块没有邮件服务：注册靠邀请码（管理员设，留空 = 不开放），忘了密码靠管理员生成一条 24 小时有效的
// 重置链接（/?reset=…）发给对方，对方打开后自己设新密码。只有管理员（第一个账号）能改这里的设置。
import { useEffect, useState } from 'react';
import { Check, CloudDownload, Copy, KeyRound, Loader2, RefreshCw, Server, UserCheck, UserX, X } from 'lucide-react';
import {
  adminResetLink, adminSetDisabled, adminStatus, adminUsers, changeMyPassword, clearResetFromUrl, getSettings, listJobs, loginServer, logoutServer,
  probeServer, putSettings, registerServer, resetPasswordServer, resetTokenFromUrl, serverToken, setServerToken, setupServer, updateMe, whoami,
  type AdminUser, type RenderJob, type ServerHealth, type ServerUser, type SettingRow, type SystemStatus,
} from '../lib/server';
import { pullAllProjects, startAutoSync, syncNow, useSync } from '../lib/sync';
import { switchProject, deleteCreation } from '../lib/session';
import { toast } from './Toast';

type Phase = 'probing' | 'none' | 'setup' | 'login' | 'register' | 'reset' | 'ready';

const fmtBytes = (n?: number | null) => n == null ? '未知' : n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(0)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const ago = (iso?: string | null) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${Math.max(m, 0)} 分钟前` : m < 48 * 60 ? `${Math.round(m / 60)} 小时前` : `${Math.round(m / 1440)} 天前`;
};

// 系统状态：每格一个数，红色就是要管的。阈值：磁盘 ≥ 85%、备份超过 36 小时没跑或没传到 OSS、OSS 连不上
function StatusBlock({ s }: { s: SystemStatus }) {
  const disk = s.disk; const pct = disk ? Math.round((disk.used / disk.total) * 100) : null;
  const backupAt = s.backup?.at || s.storage.lastBackupAt || null;
  const backupStale = !backupAt || Date.now() - Date.parse(backupAt) > 36 * 3600_000;
  const cells: { k: string; v: string; sub?: string; bad?: boolean }[] = [
    { k: '磁盘', v: disk ? `${pct}%` : '未知', sub: disk ? `${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}` : '', bad: pct != null && pct >= 85 },
    { k: '上次备份', v: backupAt ? ago(backupAt) : '还没跑过', sub: s.backup ? `${fmtBytes(s.backup.size)} · ${s.backup.ossKey ? '已传 OSS' : '只在本机'}` : (s.storage.backups ? `OSS 里 ${s.storage.backups} 份` : ''), bad: backupStale || (!!s.backup && !s.backup.ossKey) },
    { k: '存储', v: s.storage.kind === 'oss' ? (s.storage.ok ? `OSS ${s.storage.objects != null ? s.storage.objects + ' 个' : ''}` : 'OSS 连不上') : '本机磁盘', sub: s.storage.kind === 'oss' && s.storage.ok ? `${fmtBytes(s.storage.bytes)}${s.storage.truncated ? '+' : ''} · ${s.storage.auth === 'role' ? '实例角色' : 'AccessKey'}` : (s.storage.error || ''), bad: s.storage.kind === 'oss' && !s.storage.ok },
    { k: '账号 / 创作', v: s.db ? `${s.db.users} / ${s.db.projects}` : '未知', sub: s.db ? `${s.db.docs} 份文稿 · ${s.db.media} 个媒体${s.db.disabled ? ` · ${s.db.disabled} 个已停用` : ''}${s.db.media_pending_purge ? ` · ${s.db.media_pending_purge} 个待清理` : ''}` : '' },
    { k: '渲染任务', v: s.db ? `${s.db.render_active} 在跑` : '未知', sub: s.db ? `7 天内失败 ${s.db.render_failed_7d}` : '', bad: !!s.db && s.db.render_failed_7d > 0 },
    { k: '服务', v: `运行 ${ago(s.service.startedAt).replace('前', '')}`, sub: `${s.service.commit ? '版本 ' + s.service.commit + ' · ' : ''}负载 ${s.service.load1.toFixed(2)} · 内存剩 ${fmtBytes(s.service.memFree)}` },
  ];
  return (
    <div className="sv-stats">
      {cells.map(c => <div key={c.k} className={'sv-stat' + (c.bad ? ' bad' : '')}><small>{c.k}</small><b>{c.v}</b>{c.sub && <span>{c.sub}</span>}</div>)}
    </div>
  );
}

export default function ServerDialog({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('probing');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [me, setMe] = useState<ServerUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 初始化 / 登录 / 注册 / 设新密码 表单
  const [setupToken, setSetupToken] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [invite, setInvite] = useState('');
  const [resetToken, setResetToken] = useState('');

  // 设置、账号与任务
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resetLink, setResetLink] = useState<{ email: string; url: string; expiresAt: string } | null>(null);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const sync = useSync();
  const [pulling, setPulling] = useState('');

  // 我的账号：改称呼、改密码
  const [myName, setMyName] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');

  const refresh = async () => {
    const h = await probeServer();
    setHealth(h);
    if (!h) return setPhase('none');
    if (h.setup) return setPhase('setup');
    const rt = resetTokenFromUrl();
    if (rt) { setResetToken(rt); return setPhase('reset'); }      // 带着重置链接来的，先改密码
    if (!serverToken()) return setPhase('login');
    try {
      const { user } = await whoami();
      setMe(user);
      setPhase('ready');
      await loadReady(user);
    } catch {
      setServerToken('');
      setPhase('login');
    }
  };
  const loadReady = async (user: ServerUser | null) => {
    setMyName(user?.name || '');
    if (user?.isAdmin) {
      try { setRows((await getSettings()).settings); } catch (e: any) { setErr(String(e.message)); }
      try { setUsers((await adminUsers()).users); } catch { /* 列表拿不到就不显示 */ }
      try { setStatus(await adminStatus()); } catch { setStatus(null); }
    }
    try { setJobs((await listJobs()).jobs); } catch { /* 没任务就算了 */ }
  };
  useEffect(() => { void refresh(); }, []);

  // 登录态落地：存 token、开自动同步。换机器登录（pull）要把别处的创作取回来；新建的账号没什么可取，直接推本机的
  const signedIn = async (r: { token: string; user: ServerUser }, pull: boolean) => {
    setServerToken(r.token); setMe(r.user); setPassword(''); setPassword2(''); setInvite('');
    startAutoSync();
    if (pull) await doPullAll(); else void syncNow();
    await refresh();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e: any) { setErr(String(e.message)); } finally { setBusy(false); }
  };
  const doSetup = () => run(async () => {
    const r = await setupServer({ token: setupToken.trim(), email: email.trim(), password });
    toast('账号已创建，你是管理员');
    await signedIn(r, false);
  });
  const doLogin = () => run(async () => signedIn(await loginServer(email.trim(), password), true));
  const doRegister = () => run(async () => {
    const r = await registerServer({ email: email.trim(), password, name: name.trim(), invite: invite.trim() });
    toast('账号已创建');
    await signedIn(r, false);
  });
  const doReset = () => run(async () => {
    if (password !== password2) throw new Error('两次输入的密码不一样');
    const r = await resetPasswordServer(resetToken, password);
    clearResetFromUrl(); setResetToken('');
    toast('密码已改好，已用新密码登录');
    await signedIn(r, true);
  });
  const giveUpReset = () => { clearResetFromUrl(); setResetToken(''); setErr(''); setPhase('login'); };
  const doResetLink = (mail: string) => run(async () => { setResetLink(null); setResetLink(await adminResetLink(mail)); });
  const doToggleDisabled = (u: AdminUser) => run(async () => {
    setUsers((await adminSetDisabled(u.id, !u.disabled)).users);
    toast(u.disabled ? `已启用 ${u.email}` : `已停用 ${u.email}，它所有登录都已失效`);
  });
  const doSaveName = () => run(async () => { const r = await updateMe(myName); setMe(r.user); toast('称呼已改'); });
  const doChangePassword = () => run(async () => {
    if (pwNew !== pwNew2) throw new Error('两次输入的新密码不一样');
    await changeMyPassword(pwCurrent, pwNew);
    setPwCurrent(''); setPwNew(''); setPwNew2('');
    toast('密码已改，其他设备上的登录已失效');
  });
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('已复制'); } catch { toast('复制失败，手动选中复制吧'); }
  };
  const doPullAll = async () => {
    setPulling('正在取回…');
    try {
      const r = await pullAllProjects((done, total) => setPulling(`正在取回 ${done}/${total}`));
      if (!r.count) { toast('服务端这边没有别的创作'); return; }
      // 换一台机器的情形：跳到服务端最近改过的那个创作，本机那个只有示例文稿的空壳顺手删掉
      if (r.goTo) switchProject(r.goTo);
      if (r.dropped) deleteCreation(r.dropped);
      toast(`已取回 ${r.count} 个创作`);
    } catch (e: any) { setErr(String(e.message)); } finally { setPulling(''); }
  };
  const doSave = () => run(async () => {
    const patch = Object.fromEntries(Object.entries(edits).filter(([, v]) => v !== ''));
    if (!Object.keys(patch).length) return;
    const r = await putSettings(patch);
    setRows(r.settings); setEdits({});
    setHealth(await probeServer());
    toast(`已保存 ${r.changed.length} 项，立刻生效`);
  });

  const group = (g: SettingRow['group']) => rows.filter(r => r.group === g);
  // 一行设置：敏感项是密码框、只说「已配置」；bucket / 区域这种非敏感项把当前值显示出来
  const settingRow = (r: SettingRow) => (
    <label key={r.key} className="sv-key">
      <span className="sv-key-head">
        {r.label}
        {r.set && <em className="ok"><Check size={12} />{r.secret ? '已配置' : r.value}{r.from === 'env' ? '（来自 .env）' : ''}</em>}
      </span>
      <input type={r.secret ? 'password' : 'text'} autoComplete={r.secret ? 'new-password' : 'off'} spellCheck={false}
        placeholder={r.set ? '已配置，填新值可覆盖' : r.hint}
        value={edits[r.key] ?? ''} onChange={e => setEdits({ ...edits, [r.key]: e.target.value })} />
      {r.hint && <small className="muted">{r.hint}</small>}
    </label>
  );
  const field = (label: string, value: string, set: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input value={value} onChange={e => set(e.target.value)} {...extra} /></label>
  );
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') fn(); };

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
        <p className="muted">这台后端还没有任何账号。用安装时打印的那串<b>一次性口令</b>创建第一个，口令用完即失效。第一个账号就是管理员。</p>
        {field('一次性口令', setupToken, setSetupToken, { placeholder: '安装脚本最后打印的 32 位字符', autoFocus: true })}
        {field('邮箱', email, setEmail, { placeholder: '用来登录，不会发信' })}
        {field('密码', password, setPassword, { type: 'password', placeholder: '至少 8 位' })}
      </div>
    );
    if (phase === 'login') return (
      <div className="sv-form">
        {field('邮箱', email, setEmail, { autoFocus: true })}
        {field('密码', password, setPassword, { type: 'password', onKeyDown: onEnter(doLogin) })}
        <button type="button" className="sv-link" onClick={() => { setErr(''); setPhase('register'); }}>没有账号？用邀请码注册</button>
        <p className="muted sv-note">忘了密码：让管理员在「服务器设置 → 账号」里给你生成一条重置链接。</p>
      </div>
    );
    if (phase === 'register') return (
      <div className="sv-form">
        <p className="muted">邀请码向管理员要。注册完是普通账号：自己的创作自己看，服务器设置只有管理员能改。</p>
        {field('邮箱', email, setEmail, { autoFocus: true, placeholder: '用来登录，不会发信' })}
        {field('称呼（可选）', name, setName, { placeholder: '显示在账号列表里' })}
        {field('密码', password, setPassword, { type: 'password', placeholder: '至少 8 位' })}
        {field('邀请码', invite, setInvite, { onKeyDown: onEnter(doRegister) })}
        <button type="button" className="sv-link" onClick={() => { setErr(''); setPhase('login'); }}>已有账号？去登录</button>
      </div>
    );
    if (phase === 'reset') return (
      <div className="sv-form">
        <p className="muted">你打开的是一条<b>密码重置链接</b>。设一个新密码，保存后直接登录；这条链接随即作废。</p>
        {field('新密码', password, setPassword, { type: 'password', placeholder: '至少 8 位', autoFocus: true })}
        {field('再输一次', password2, setPassword2, { type: 'password', onKeyDown: onEnter(doReset) })}
        <button type="button" className="sv-link" onClick={giveUpReset}>不改了，去登录</button>
      </div>
    );
    const st = health?.storage;
    return (
      <div className="sv-ready">
        <div className="sv-status">
          <span className={health?.db ? 'ok' : 'bad'}>数据库 {health?.db ? '正常' : '未连接'}</span>
          <span className={health?.render ? 'ok' : 'bad'}>渲染 {health?.render ? '就绪' : '未安装'}</span>
          <span className={st?.kind === 'oss' ? (st.ok ? 'ok' : 'bad') : 'muted'}>存储 {st?.kind === 'oss' ? `OSS · ${st.bucket}${st.ok ? '' : '（连不上）'}` : '本机磁盘'}</span>
          <span className="muted">{me?.email}{me?.isAdmin ? ' · 管理员' : ''}</span>
        </div>
        {st?.kind === 'oss' && !st.ok && <p className="sv-err">OSS 连不上：{st.error}。现在上传和下载都会失败——修好下面的配置，或者把 OSS Bucket 清掉（填一个空格再保存）回到本机磁盘。</p>}

        <h3>数据同步 <button type="button" className="icon-btn" onClick={() => void syncNow()} aria-label="立即同步"><RefreshCw size={13} className={sync.status === 'syncing' ? 'spin' : ''} /></button></h3>
        <p className="muted sv-sync">
          {sync.status === 'syncing' ? '正在同步…'
            : sync.status === 'error' ? <span className="bad">同步失败：{sync.error}</span>
            : sync.at ? `上次同步 ${new Date(sync.at).toLocaleTimeString()}　拉回 ${sync.pulled} 条、推上 ${sync.pushed} 条`
            : '文稿、媒体与对话会在改动后几秒自动同步；图片视频的文件随后单独上传。'}
        </p>
        <button type="button" className="btn" disabled={!!pulling} onClick={() => void doPullAll()}>
          <CloudDownload size={13} />{pulling || '取回服务端的全部创作'}
        </button>

        <h3>我的账号</h3>
        <div className="sv-form sv-account">
          <div className="sv-inline">
            <label>称呼<input value={myName} onChange={e => setMyName(e.target.value)} placeholder="显示在账号列表里" /></label>
            <button type="button" className="btn" disabled={busy || myName === (me?.name || '')} onClick={() => void doSaveName()}>保存</button>
          </div>
          <div className="sv-inline">
            <label>当前密码<input type="password" autoComplete="current-password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} /></label>
            <label>新密码<input type="password" autoComplete="new-password" value={pwNew} onChange={e => setPwNew(e.target.value)} placeholder="至少 8 位" /></label>
            <label>再输一次<input type="password" autoComplete="new-password" value={pwNew2} onChange={e => setPwNew2(e.target.value)} onKeyDown={onEnter(doChangePassword)} /></label>
            <button type="button" className="btn" disabled={busy || !pwCurrent || pwNew.length < 8 || !pwNew2} onClick={() => void doChangePassword()}>改密码</button>
          </div>
          <p className="muted sv-note">改完密码，其他设备上的登录会全部失效，当前这个保留。</p>
        </div>

        {me?.isAdmin ? (
          <>
            <h3>系统状态 <button type="button" className="icon-btn" onClick={() => void adminStatus().then(setStatus).catch(() => setStatus(null))} aria-label="刷新状态"><RefreshCw size={13} /></button></h3>
            {status ? <StatusBlock s={status} /> : <p className="muted">状态拿不到（后端版本太旧，或者接口报错）。</p>}

            <h3>模型 key</h3>
            <p className="muted">填完立刻生效，不用重启。留空表示不改；填一个空格再保存表示清掉它。
              已配置的不会回显——后端只告诉界面「配没配」，不回传值本身。</p>
            <div className="sv-keys">{group('model').map(settingRow)}</div>

            <h3>媒体存储</h3>
            <p className="muted">图片、视频、成片的文件默认存服务器本机磁盘（40G 会满）。填上阿里云 OSS 的 bucket 与一把只管这个 bucket 的 RAM AccessKey 就切过去，
              填完即生效；老文件还在磁盘上也能读，之后在服务器上跑 <code>npm run blobs:migrate</code> 搬过去。</p>
            <div className="sv-keys">{group('storage').map(settingRow)}</div>

            <h3>账号</h3>
            <p className="muted">注册靠邀请码：留空就是不开放注册。谁忘了密码，在下面给那个邮箱生成一条重置链接（24 小时有效、用一次作废），发给对方自己改。</p>
            <div className="sv-keys">{group('account').map(settingRow)}</div>
            {users.length > 0 && (
              <ul className="sv-users">
                {users.map(u => (
                  <li key={u.id} className={u.disabled ? 'off' : ''}>
                    <b>{u.email}{u.name ? ` · ${u.name}` : ''}</b>
                    {u.isAdmin && <span className="tag">管理员</span>}
                    {u.disabled && <span className="tag off">已停用</span>}
                    <small>{u.lastLogin ? `上次登录 ${new Date(u.lastLogin).toLocaleDateString()}` : '还没登录过'}</small>
                    <button type="button" className="icon-btn" title="生成密码重置链接" aria-label={`给 ${u.email} 生成密码重置链接`} disabled={busy} onClick={() => void doResetLink(u.email)}><KeyRound size={13} /></button>
                    {u.id !== me?.id && (
                      <button type="button" className="icon-btn" title={u.disabled ? '启用这个账号' : '停用这个账号（登不进、已登录的全部失效，数据保留）'} aria-label={`${u.disabled ? '启用' : '停用'} ${u.email}`} disabled={busy} onClick={() => void doToggleDisabled(u)}>
                        {u.disabled ? <UserCheck size={13} /> : <UserX size={13} />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {resetLink && (
              <div className="sv-reset-link">
                <span>给 <b>{resetLink.email}</b> 的重置链接，{new Date(resetLink.expiresAt).toLocaleString()} 前有效、用一次作废。发给对方，打开后自己设新密码：</span>
                <div className="row">
                  <input readOnly value={location.origin + resetLink.url} onFocus={e => e.currentTarget.select()} />
                  <button type="button" className="btn" onClick={() => void copy(location.origin + resetLink.url)}><Copy size={13} />复制</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="muted sv-note">模型 key、媒体存储与账号这些服务器设置只有管理员能改。</p>
        )}

        <h3>渲染任务 <button type="button" className="icon-btn" onClick={() => void loadReady(me)} aria-label="刷新"><RefreshCw size={13} /></button></h3>
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
    const cancel = <button type="button" className="btn" onClick={onClose}>取消</button>;
    if (phase === 'setup') return <>{cancel}<button type="button" className="btn primary" disabled={busy || !setupToken.trim() || !email.trim() || password.length < 8} onClick={() => void doSetup()}>创建账号</button></>;
    if (phase === 'login') return <>{cancel}<button type="button" className="btn primary" disabled={busy || !email.trim() || !password} onClick={() => void doLogin()}>登录</button></>;
    if (phase === 'register') return <>{cancel}<button type="button" className="btn primary" disabled={busy || !email.trim() || password.length < 8 || !invite.trim()} onClick={() => void doRegister()}>注册</button></>;
    if (phase === 'reset') return <>{cancel}<button type="button" className="btn primary" disabled={busy || password.length < 8 || !password2} onClick={() => void doReset()}>保存新密码</button></>;
    if (phase === 'ready') return <>
      <button type="button" className="btn" onClick={() => void logoutServer().then(refresh)}>退出登录</button>
      <span style={{ flex: 1 }} />
      <button type="button" className="btn" onClick={onClose}>关闭</button>
      {me?.isAdmin && <button type="button" className="btn primary" disabled={busy || !Object.values(edits).some(v => v !== '')} onClick={() => void doSave()}>保存</button>}</>;
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
