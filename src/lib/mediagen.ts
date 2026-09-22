// ===== 图片 / 视频生成：经 Moodio 网关调用 fal.ai 队列接口，结果下载进媒体库 =====
// 网关持有真实的 fal key（Worker secret FAL_KEY），页面只带访问口令；模型与偏好在输入框的「模型」面板里选，存在 localStorage moodio-agent-model。
import type { MediaItem, ModelConfig } from './types';
import { uid } from './types';
import { modelCfg, PROVIDER_DEFAULTS } from './model';
import { useFiles, findMedia, useAgent } from './store';
import { putBlob, cacheUrl, getBlob, imageSize } from './storage';
import { sanitizeName } from './markdown';
import type { ModelPreset, RatioKey } from './mediamodels';
import { IMAGE_MODELS, VIDEO_MODELS, VIDEO_IMAGE_MODELS, presetFor, ratioValue, arkImageSize } from './mediamodels';

export const MEDIA_DEFAULTS = {
  baseUrl: PROVIDER_DEFAULTS.openai.baseUrl.replace(/\/v1$/, ''),
  imageModel: IMAGE_MODELS[0].id,
  videoModel: VIDEO_MODELS[0].id,
  videoImageModel: VIDEO_IMAGE_MODELS[0].id,
  imageRatio: '16:9' as RatioKey,
  videoRatio: '16:9' as RatioKey,
  videoDuration: '5',
  videoResolution: '720p',
};

export interface MediaEndpoint { base: string; token: string; }
// 网关地址与口令：默认沿用对话用的那套（provider 为 OpenAI 兼容时 baseUrl 去掉 /v1），也可在设置里单独指定
export function mediaEndpoint(cfg: ModelConfig | null = modelCfg()): MediaEndpoint | null {
  const base = String(cfg?.mediaBaseUrl || '').trim().replace(/\/+$/, '')
    || (cfg?.provider !== 'claude' ? String(cfg?.baseUrl || MEDIA_DEFAULTS.baseUrl).trim().replace(/\/+$/, '').replace(/\/v1$/, '') : MEDIA_DEFAULTS.baseUrl);
  const token = String(cfg?.mediaToken || '').trim() || (cfg?.provider !== 'claude' ? String(cfg?.apiKey || '').trim() : '');
  if (!base || !token) return null;
  return { base, token };
}
export function mediaReadyReason(): string | null {
  const cfg = modelCfg();
  if (!cfg?.apiKey && !cfg?.mediaToken) return '还没有连接模型网关，请先在设置里填写访问口令。';
  if (!mediaEndpoint(cfg)) return '还没有配置生成图片 / 视频的网关地址和口令，请在设置里补上。';
  return null;
}

// 当前选中的模型（面板与生成函数共用同一份取值逻辑）
export function currentImageModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.imageModel || MEDIA_DEFAULTS.imageModel); }
export function currentVideoModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.videoModel || MEDIA_DEFAULTS.videoModel); }
export function currentVideoImageModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.videoImageModel || MEDIA_DEFAULTS.videoImageModel); }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function readError(res: Response): Promise<string> {
  let text = ''; try { text = await res.text(); } catch { /* ignore */ }
  try { const j = JSON.parse(text); const d = j?.error?.message || j?.detail || j?.message; if (typeof d === 'string') return d; if (Array.isArray(j?.detail)) return j.detail.map((x: any) => x?.msg || JSON.stringify(x)).join('；'); } catch { /* ignore */ }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}
// fal 返回的 status_url / response_url / cancel_url 指向 queue.fal.run，改写成走网关（浏览器没有 fal key）
function viaGateway(url: string, base: string): string {
  try { const u = new URL(url); return base + '/fal' + u.pathname + u.search; } catch { return url; }
}
function pickUrl(result: any): { url: string; contentType?: string } | null {
  const cands = [result?.images?.[0], result?.image, result?.video, result?.videos?.[0], result?.audio, result?.output?.[0], result?.data?.images?.[0], result?.data?.video];
  for (const c of cands) { if (typeof c === 'string' && /^https?:/.test(c)) return { url: c }; if (c && typeof c.url === 'string') return { url: c.url, contentType: c.content_type }; }
  if (typeof result?.url === 'string') return { url: result.url };
  return null;
}
// fal：按模型声明拼可选参数，模型不认识的字段一律不发，免得被 422 退回
export function buildInput(preset: ModelPreset, prompt: string, { ratio, duration }: { ratio?: RatioKey; duration?: string }): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };
  if (preset.ratio && preset.ratio !== 'arg' && ratio) input[preset.ratio] = ratioValue(preset.ratio, ratio);
  if (preset.duration && duration) input.duration = String(duration);
  return input;
}
// 方舟：画幅 / 时长 / 分辨率以 --ratio --duration --resolution 拼在提示词后面
export function arkPromptArgs(preset: ModelPreset, prompt: string, { ratio, duration, resolution }: { ratio?: RatioKey; duration?: string; resolution?: string }): string {
  const args: string[] = [];
  if (preset.ratio === 'arg' && ratio) args.push(`--ratio ${ratio}`);
  if (preset.duration && duration) args.push(`--duration ${duration}`);
  if (preset.resolution && resolution) args.push(`--resolution ${resolution}`);
  return args.length ? `${prompt} ${args.join(' ')}` : prompt;
}

export const __test = { viaGateway, pickUrl, buildInput, arkPromptArgs };   // 仅供单元测试

export interface GenOptions { onProgress?: (text: string) => void; signal?: AbortSignal; }

// 提交到 fal 队列并轮询；中途停止或出错时顺手取消队列任务，避免白算白付费
async function runFal(model: string, input: Record<string, unknown>, { onProgress, signal }: GenOptions, timeoutMs: number): Promise<any> {
  const ep = mediaEndpoint(); if (!ep) throw new Error(mediaReadyReason() || '网关未配置');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ep.token };
  const submit = await fetch(`${ep.base}/fal/${String(model).replace(/^\/+/, '')}`, { method: 'POST', headers, body: JSON.stringify(input), signal });
  if (!submit.ok) throw new Error('提交生成任务失败：' + await readError(submit));
  const queued = await submit.json();
  const statusUrl = queued?.status_url ? viaGateway(queued.status_url, ep.base) : null;
  const responseUrl = queued?.response_url ? viaGateway(queued.response_url, ep.base) : null;
  const cancelUrl = queued?.cancel_url ? viaGateway(queued.cancel_url, ep.base) : null;
  if (!statusUrl || !responseUrl) { if (pickUrl(queued)) return queued; throw new Error('网关返回的任务信息不完整'); }
  const cancel = () => { if (cancelUrl) fetch(cancelUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + ep.token } }).catch(() => {}); };
  const started = Date.now();
  try {
    for (let i = 0; ; i++) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
      if (Date.now() - started > timeoutMs) throw new Error('生成超时，任务可能仍在队列里，请稍后重试');
      await sleep(i === 0 ? 1200 : 2000);
      const res = await fetch(statusUrl, { headers: { Authorization: 'Bearer ' + ep.token }, signal });
      if (!res.ok) throw new Error('查询生成状态失败：' + await readError(res));
      const st = await res.json();
      const phase = String(st?.status || '');
      if (phase === 'COMPLETED') break;
      if (phase === 'FAILED' || phase === 'ERROR') throw new Error('生成失败：' + (st?.error || JSON.stringify(st).slice(0, 200)));
      const secs = Math.round((Date.now() - started) / 1000);
      onProgress?.(phase === 'IN_QUEUE' ? `排队中${typeof st?.queue_position === 'number' ? `（第 ${st.queue_position} 位）` : ''} · ${secs}s` : `生成中 · ${secs}s`);
    }
  } catch (e) { cancel(); throw e; }
  const done = await fetch(responseUrl, { headers: { Authorization: 'Bearer ' + ep.token }, signal });
  if (!done.ok) throw new Error('读取生成结果失败：' + await readError(done));
  return done.json();
}

// ===== 火山方舟 =====
async function arkFetch(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<any> {
  const ep = mediaEndpoint(); if (!ep) throw new Error(mediaReadyReason() || '网关未配置');
  const res = await fetch(`${ep.base}/ark${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ep.token, ...(init.headers || {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const err = data?.error || {};
    if (err.code === 'ModelNotOpen') throw new Error('这个模型还没在火山方舟控制台开通，去「开通管理」里开通后即可使用');
    if (err.code === 'AccountOverdueError') throw new Error('火山方舟账户余额不足，请先充值');
    throw new Error('火山方舟返回错误：' + (err.message || `HTTP ${res.status}`));
  }
  return data;
}
// 方舟视频：创建任务 → 轮询 → 拿 video_url；中途停止会删掉任务
async function runArkVideo(model: string, content: unknown[], { onProgress, signal }: GenOptions, timeoutMs: number): Promise<string> {
  const created = await arkFetch('/contents/generations/tasks', { method: 'POST', body: JSON.stringify({ model, content }), signal });
  const id = created?.id; if (!id) throw new Error('火山方舟没有返回任务 id');
  const started = Date.now();
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
      if (Date.now() - started > timeoutMs) throw new Error('生成超时，任务可能仍在队列里，请稍后重试');
      await sleep(2000);
      const task = await arkFetch(`/contents/generations/tasks/${encodeURIComponent(id)}`, { signal });
      const status = String(task?.status || '');
      if (status === 'succeeded') { const url = task?.content?.video_url; if (!url) throw new Error('生成结果里没有视频地址'); return url; }
      if (status === 'failed' || status === 'cancelled') throw new Error('生成失败：' + (task?.error?.message || status));
      const secs = Math.round((Date.now() - started) / 1000);
      onProgress?.(status === 'queued' ? `排队中 · ${secs}s` : `生成中 · ${secs}s`);
    }
  } catch (e) {
    arkFetch(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    throw e;
  }
}

// 把结果地址下载进媒体库（经网关代下载，避免跨域）
async function storeResult(url: string, { name, group, kind, contentType }: { name: string; group: string; kind: 'image' | 'video'; contentType?: string }): Promise<MediaItem> {
  const ep = mediaEndpoint(); if (!ep) throw new Error('网关未配置');
  const res = await fetch(`${ep.base}/media?url=${encodeURIComponent(url)}`, { headers: { Authorization: 'Bearer ' + ep.token } });
  if (!res.ok) throw new Error('下载生成结果失败：' + await readError(res));
  const blob = await res.blob();
  const mime = contentType || blob.type || (kind === 'image' ? 'image/png' : 'video/mp4');
  const ext = (mime.split('/')[1] || (kind === 'image' ? 'png' : 'mp4')).replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const id = uid('m');
  await putBlob(id, blob); cacheUrl(id, blob);
  const size = kind === 'image' ? await imageSize(blob) : null;
  const finalName = /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.${ext}`;
  const meta: MediaItem = { id, name: finalName, kind, mime, size: blob.size, group, createdAt: Date.now(), by: 'agent', width: size?.width, height: size?.height };
  useFiles.getState().addMedia(meta);
  return meta;
}

export interface ImageRequest { prompt: string; name?: string; group?: string; ratio?: RatioKey; model?: string; }
export async function generateImage(req: ImageRequest, opts: GenOptions = {}): Promise<MediaItem> {
  const prompt = String(req.prompt || '').trim(); if (!prompt) throw new Error('缺少画面描述');
  const cfg = modelCfg();
  const model = req.model || currentImageModel(cfg);
  const preset = presetFor(IMAGE_MODELS, model, 'image');
  const ratio = (req.ratio || cfg?.imageRatio || MEDIA_DEFAULTS.imageRatio) as RatioKey;
  opts.onProgress?.('提交生成任务…');
  let url: string, contentType: string | undefined;
  if (preset.provider === 'ark') {
    const started = Date.now();   // 方舟出图是一次同步调用，自己报个计时，别让状态一直停在「提交」
    const ticking = setInterval(() => opts.onProgress?.(`生成中 · ${Math.round((Date.now() - started) / 1000)}s`), 1000);
    try {
      const data = await arkFetch('/images/generations', { method: 'POST', body: JSON.stringify({ model, prompt, size: arkImageSize(ratio), response_format: 'url', watermark: false }), signal: opts.signal });
      url = data?.data?.[0]?.url; if (!url) throw new Error('生成结果里没有图片地址');
    } finally { clearInterval(ticking); }
  } else {
    const result = await runFal(model, buildInput(preset, prompt, { ratio }), opts, 4 * 60e3);
    const hit = pickUrl(result); if (!hit) throw new Error('生成结果里没有图片地址');
    url = hit.url; contentType = hit.contentType;
  }
  opts.onProgress?.('下载生成结果…');
  return storeResult(url, { name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', kind: 'image', contentType });
}

export interface VideoRequest { prompt: string; name?: string; group?: string; ratio?: RatioKey; duration?: string | number; fromMediaId?: string; model?: string; }
export async function generateVideo(req: VideoRequest, opts: GenOptions = {}): Promise<MediaItem> {
  const prompt = String(req.prompt || '').trim(); if (!prompt) throw new Error('缺少画面描述');
  const cfg = modelCfg();
  const duration = String(req.duration || cfg?.videoDuration || MEDIA_DEFAULTS.videoDuration).replace(/[^0-9]/g, '') || '5';
  const fromImage = !!req.fromMediaId;
  const model = req.model || (fromImage ? currentVideoImageModel(cfg) : currentVideoModel(cfg));
  const preset = presetFor(fromImage ? VIDEO_IMAGE_MODELS : VIDEO_MODELS, model, fromImage ? 'videoImage' : 'video');
  const ratio = (req.ratio || cfg?.videoRatio || MEDIA_DEFAULTS.videoRatio) as RatioKey;
  const resolution = cfg?.videoResolution || MEDIA_DEFAULTS.videoResolution;
  let imageDataUrl = '';
  if (fromImage) {
    const src = findMedia(req.fromMediaId!); if (!src) throw new Error(`找不到 id 为「${req.fromMediaId}」的图片`);
    if (src.kind !== 'image') throw new Error('参考素材必须是图片');
    const blob = await getBlob(src.id); if (!blob) throw new Error(`「${src.name}」的文件不在本机媒体库里`);
    imageDataUrl = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(new Error('读取参考图失败')); fr.readAsDataURL(blob); });
  }
  opts.onProgress?.('提交生成任务…');
  let url: string, contentType: string | undefined;
  if (preset.provider === 'ark') {
    const text = arkPromptArgs(preset, prompt, { ratio: fromImage ? undefined : ratio, duration, resolution });
    const content: unknown[] = [{ type: 'text', text }];
    if (imageDataUrl) content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    url = await runArkVideo(model, content, opts, 12 * 60e3);
  } else {
    const input = buildInput(preset, prompt, { ratio: fromImage ? undefined : ratio, duration });
    if (imageDataUrl) input.image_url = imageDataUrl;
    const result = await runFal(model, input, opts, 12 * 60e3);
    const hit = pickUrl(result); if (!hit) throw new Error('生成结果里没有视频地址');
    url = hit.url; contentType = hit.contentType;
  }
  opts.onProgress?.('下载生成结果…');
  return storeResult(url, { name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', kind: 'video', contentType });
}

// 不经 Agent 的手动生成（输入框「+」菜单）：占用同一套忙碌状态与流光，可用胶囊上的「停止」中断
export async function manualGenerate(kind: 'image' | 'video', req: ImageRequest & VideoRequest): Promise<MediaItem> {
  const agent = useAgent.getState();
  if (agent.busy) throw new Error('上一个任务还在执行，等它完成或点「停止」');
  const reason = mediaReadyReason(); if (reason) throw new Error(reason);
  const controller = new AbortController();
  agent.set({ busy: true, glow: true, abortRequested: false, controller, live: '提交生成任务…' });
  const opts: GenOptions = { signal: controller.signal, onProgress: text => useAgent.getState().set({ live: text }) };
  try {
    const item = kind === 'image' ? await generateImage(req, opts) : await generateVideo(req, opts);
    useFiles.getState().openInPane(item.id);   // 生成完直接在工作区打开，和 Agent 生成时的行为一致
    return item;
  }
  finally { useAgent.getState().set({ busy: false, glow: false, live: '', controller: null }); }
}
