// ===== 自建后端的客户端：探测、初始化、登录、服务端设置、渲染任务 =====
// 页面和后端同源部署时（Caddy 把 /api/* 反代到后端），这里全走相对路径。
// 没有后端的时候（本机 vite、或页面托管在别处）所有调用都会失败，调用方按「没有后端」处理即可。
const TOKEN_KEY = 'wow-server-token';

export interface StorageHealth { kind: 'local' | 'oss'; ok: boolean; error?: string; bucket?: string; region?: string; dir?: string }
export interface ServerHealth {
  ok: boolean; service: string; db: boolean; render: boolean; blobs: string;
  storage?: StorageHealth;              // 媒体文件存哪、通不通
  setup: boolean;                       // true = 还没有任何账号，要先初始化
  deepseek: boolean; kimi: boolean; fal: boolean; ark: boolean; byteplus: boolean;
}
export interface ServerUser { id: string; email: string; name: string; isAdmin?: boolean; disabled?: boolean }
export interface AdminUser extends ServerUser { createdAt: string; lastLogin: string | null }
// 管理员看的系统状态（/api/admin/status）。拿不到的项是 null，界面写「未知」
export interface SystemStatus {
  disk: { total: number; free: number; used: number } | null;
  backup: { file: string; size: number; at: string; ossKey: string } | null;
  storage: StorageHealth & { auth?: 'role' | 'ak'; objects?: number; bytes?: number; truncated?: boolean; backups?: number; lastBackupKey?: string | null; lastBackupAt?: string | null; listError?: string };
  db: { users: number; disabled: number; projects: number; docs: number; media: number; media_pending_purge: number; render_active: number; render_failed_7d: number } | null;
  service: { startedAt: string; node: string; commit: string; load1: number; memFree: number; memTotal: number };
}
export interface SettingRow {
  key: string; label: string; hint: string; secret: boolean;
  group: 'model' | 'storage' | 'account';
  value: string;                        // 只有非敏感项（bucket / 区域）回传当前值，敏感项永远是空串
  set: boolean; from: 'db' | 'env' | null; updatedAt: string | null;
}
type Session = { token: string; user: ServerUser };
export interface RenderJob {
  id: string; title: string; status: 'queued' | 'running' | 'done' | 'failed' | 'canceled';
  stage: string; progress: number; error: string | null;
  readcheck: { ok: boolean; report: string } | null;
  object_key: string | null; created_at: string; finished_at: string | null;
}

export const serverToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
export const setServerToken = (t: string) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* 无痕模式 */ } };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = serverToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* 非 JSON（比如代理返回的 HTML 错误页） */ }
  if (!res.ok) throw new Error(data?.error?.message || `接口返回 ${res.status}`);
  return data as T;
}

// 有没有自建后端：失败就是没有，不抛错，调用方好写
export async function probeServer(): Promise<ServerHealth | null> {
  try {
    const h = await call<ServerHealth>('/health');
    return h?.service === 'wow-server' ? h : null;
  } catch { return null; }
}

export const setupServer = (p: { token: string; email: string; password: string; name?: string }) =>
  call<Session>('/api/auth/setup', { method: 'POST', body: JSON.stringify(p) });

export const loginServer = (email: string, password: string) =>
  call<Session>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

// 用邀请码注册（邀请码由管理员在服务器设置里设，没设就是不开放）
export const registerServer = (p: { email: string; password: string; name?: string; invite: string }) =>
  call<Session>('/api/auth/register', { method: 'POST', body: JSON.stringify(p) });

// 拿重置链接里的 token 设新密码，成功直接是登录态
export const resetPasswordServer = (token: string, password: string) =>
  call<Session>('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) });

// 重置链接长这样：https://站点/?reset=<token>。页面打开时看一眼有没有，有就直接进「设新密码」
export const resetTokenFromUrl = () => { try { return new URLSearchParams(location.search).get('reset') || ''; } catch { return ''; } };
export const clearResetFromUrl = () => { try { const u = new URL(location.href); u.searchParams.delete('reset'); history.replaceState(null, '', u.toString()); } catch { /* 无所谓 */ } };

// 自己的账号：改称呼、改密码（要当前密码；改完其他设备上的登录全部失效）
export const updateMe = (name: string) => call<{ user: ServerUser }>('/api/me', { method: 'PUT', body: JSON.stringify({ name }) });
export const changeMyPassword = (current: string, password: string) =>
  call<{ ok: true }>('/api/me/password', { method: 'POST', body: JSON.stringify({ current, password }) });

// 管理员：账号列表、停用 / 启用、给某个邮箱生成重置链接、系统状态
export const adminUsers = () => call<{ users: AdminUser[] }>('/api/admin/users');
export const adminSetDisabled = (id: string, disabled: boolean) =>
  call<{ users: AdminUser[] }>(`/api/admin/users/${id}/${disabled ? 'disable' : 'enable'}`, { method: 'POST' });
export const adminStatus = () => call<SystemStatus>('/api/admin/status');
export const adminResetLink = (email: string) =>
  call<{ email: string; url: string; expiresAt: string }>('/api/admin/reset-link', { method: 'POST', body: JSON.stringify({ email }) });

export async function logoutServer() {
  try { await call('/api/auth/logout', { method: 'POST' }); } catch { /* 本地清掉就行 */ }
  setServerToken('');
}

export const whoami = () => call<{ user: ServerUser }>('/api/me');
export const getSettings = () => call<{ settings: SettingRow[] }>('/api/settings');
export const putSettings = (settings: Record<string, string>) =>
  call<{ changed: string[]; settings: SettingRow[] }>('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
export const listJobs = () => call<{ jobs: RenderJob[] }>('/api/render');
