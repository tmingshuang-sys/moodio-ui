// ===== 自建后端的客户端：探测、初始化、登录、服务端设置、渲染任务 =====
// 页面和后端同源部署时（Caddy 把 /api/* 反代到后端），这里全走相对路径。
// 没有后端的时候（本机 vite、或页面托管在别处）所有调用都会失败，调用方按「没有后端」处理即可。
const TOKEN_KEY = 'wow-server-token';

export interface ServerHealth {
  ok: boolean; service: string; db: boolean; render: boolean; blobs: string;
  setup: boolean;                       // true = 还没有任何账号，要先初始化
  deepseek: boolean; kimi: boolean; fal: boolean; ark: boolean; byteplus: boolean;
}
export interface SettingRow {
  key: string; label: string; hint: string; secret: boolean;
  set: boolean; from: 'db' | 'env' | null; updatedAt: string | null;
}
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
  call<{ token: string; user: { id: string; email: string; name: string } }>('/api/auth/setup', { method: 'POST', body: JSON.stringify(p) });

export const loginServer = (email: string, password: string) =>
  call<{ token: string; user: { id: string; email: string; name: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export async function logoutServer() {
  try { await call('/api/auth/logout', { method: 'POST' }); } catch { /* 本地清掉就行 */ }
  setServerToken('');
}

export const whoami = () => call<{ user: { id: string; email: string; name: string } }>('/api/me');
export const getSettings = () => call<{ settings: SettingRow[] }>('/api/settings');
export const putSettings = (settings: Record<string, string>) =>
  call<{ changed: string[]; settings: SettingRow[] }>('/api/settings', { method: 'PUT', body: JSON.stringify({ settings }) });
export const listJobs = () => call<{ jobs: RenderJob[] }>('/api/render');
