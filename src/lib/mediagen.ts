// ===== 图片 / 视频生成：经 Moodio 网关调用 fal.ai 队列接口，结果下载进媒体库 =====
// 网关持有真实的 fal key（Worker secret FAL_KEY），页面只带访问口令；模型与偏好在输入框的「模型」面板里选，存在 localStorage moodio-agent-model。
import type { MediaItem, ModelConfig } from './types';
import { uid } from './types';
import { modelCfg, PROVIDER_DEFAULTS, MODEL_KEY as MODEL_KEY_FOR_MIGRATION } from './model';
import { useFiles, findMedia, useAgent } from './store';
import { useTasks, runningTasks, patchStep } from './tasks';
import type { GenTask, TaskRef } from './tasks';
import { toast } from '../components/Toast';
import { putBlob, cacheUrl, getBlob, imageSize } from './storage';
import { sanitizeName } from './markdown';
import type { ModelPreset, RatioKey } from './mediamodels';
import { IMAGE_MODELS, VIDEO_MODELS, VIDEO_IMAGE_MODELS, VOICE_MODELS, VOICE_DESIGN_MODEL, VOICE_DESIGN_PRESET, presetFor, ratioValue, arkImageSize, resolveDuration, AUTO, AUTO_CHAINS, isAuto, modelChain, findPreset, runWithFallback, isArkLike } from './mediamodels';
import type { Provider } from './mediamodels';
import type { ModelKind } from './mediamodels';
import { makeProfile } from './strategy';
import type { VideoProfile } from './strategy';

export const MEDIA_DEFAULTS = {
  baseUrl: PROVIDER_DEFAULTS.openai.baseUrl.replace(/\/v1$/, ''),
  imageModel: AUTO,        // 智能匹配：Seedream 5.0 起，不可用时沿候选链换
  videoModel: AUTO,        // 智能匹配：Seedance 2.5 起
  videoImageModel: AUTO,
  voiceModel: AUTO,        // 智能匹配：MiniMax Speech 2.8 HD 起
  imageRatio: '16:9' as RatioKey,
  videoRatio: '16:9' as RatioKey,
  videoDuration: '5',
  videoResolution: '720p',
  imageResolution: '2K',
  durationMode: 'smart' as const,
  genMode: 'manual' as const,
};
export const genMode = (cfg: ModelConfig | null = modelCfg()): 'manual' | 'auto' => (cfg?.genMode === 'auto' ? 'auto' : 'manual');

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

// 当前选中的模型（面板与生成函数共用同一份取值逻辑；'auto' = 智能匹配）
export function currentImageModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.imageModel || MEDIA_DEFAULTS.imageModel); }
export function currentVideoModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.videoModel || MEDIA_DEFAULTS.videoModel); }
export function currentVideoImageModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.videoImageModel || MEDIA_DEFAULTS.videoImageModel); }
export function currentVoiceModel(cfg: ModelConfig | null = modelCfg()) { return String(cfg?.voiceModel || MEDIA_DEFAULTS.voiceModel); }
// 生成策略要按「实际会用到的视频模型」判断能力：智能匹配时优先看上次真正跑成的那个（还在候选链里才算），没有就按候选链第一个
const LAST_VIDEO_KEY = 'moodio-last-video-model';
export function effectiveVideoId(cfg: ModelConfig | null = modelCfg()): string {
  const wanted = currentVideoModel(cfg); if (!isAuto(wanted)) return wanted;
  try { const last = localStorage.getItem(LAST_VIDEO_KEY) || ''; if (last && AUTO_CHAINS.video.includes(last)) return last; } catch { /* ignore */ }
  return AUTO_CHAINS.video[0];
}
export function videoProfile(cfg: ModelConfig | null = modelCfg()): VideoProfile {
  return makeProfile(presetFor(VIDEO_MODELS, effectiveVideoId(cfg), 'video'), effectivePreset('videoImage', currentVideoImageModel(cfg)));
}
const listFor = (kind: ModelKind) => kind === 'image' ? IMAGE_MODELS : kind === 'video' ? VIDEO_MODELS : kind === 'voice' ? VOICE_MODELS : VIDEO_IMAGE_MODELS;
// 面板与生成共用：智能匹配时按候选链第一个模型的能力显示选项
export function effectivePreset(kind: ModelKind, id: string | undefined): ModelPreset {
  const list = listFor(kind);
  return isAuto(id) ? (findPreset(list, AUTO_CHAINS[kind][0]) || presetFor(list, AUTO_CHAINS[kind][0], kind)) : presetFor(list, id, kind);
}
export function modelDisplayName(kind: ModelKind, id: string | undefined): string {
  if (isAuto(id)) return '智能匹配'; if (id === VOICE_DESIGN_MODEL) return VOICE_DESIGN_PRESET.name;
  const list = listFor(kind);
  return findPreset(list, id)?.name || String(id);
}
// 旧配置里存的是具体模型 id：第一次带智能匹配的版本启动时改成默认的智能匹配（只做一次）
(() => { try { if (localStorage.getItem('moodio-model-prefs-v2')) return; const cfg = modelCfg(); if (cfg) { localStorage.setItem(MODEL_KEY_FOR_MIGRATION, JSON.stringify({ ...cfg, imageModel: AUTO, videoModel: AUTO, videoImageModel: AUTO })); } localStorage.setItem('moodio-model-prefs-v2', '1'); } catch { /* ignore */ } })();

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

export const __test = { viaGateway, pickUrl, buildInput, arkPromptArgs, arkVideoContent };   // 仅供单元测试

export interface GenOptions { onProgress?: (text: string) => void; signal?: AbortSignal; task?: TaskRef; }
// 任务落盘需要的元信息（结果叫什么、进哪个分区、用的哪个模型）
interface TaskMeta { kind: 'image' | 'video' | 'audio'; name: string; group: string; prompt: string; model: string; ref?: TaskRef; }
const registerTask = (t: GenTask) => { try { useTasks.getState().add(t); } catch { /* ignore */ } };
const finishTask = (id: string | null) => { if (id) try { useTasks.getState().remove(id); } catch { /* ignore */ } };

// 提交到 fal 队列并轮询；中途停止或出错时顺手取消队列任务，避免白算白付费
async function runFal(model: string, input: Record<string, unknown>, { onProgress, signal }: GenOptions, timeoutMs: number, meta?: TaskMeta): Promise<any> {
  const ep = mediaEndpoint(); if (!ep) throw new Error(mediaReadyReason() || '网关未配置');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ep.token };
  const submit = await fetch(`${ep.base}/fal/${String(model).replace(/^\/+/, '')}`, { method: 'POST', headers, body: JSON.stringify(input), signal });
  if (!submit.ok) { const err: any = new Error('提交生成任务失败：' + await readError(submit)); err.code = 'HTTP_' + submit.status; throw err; }
  const queued = await submit.json();
  const statusUrl = queued?.status_url ? viaGateway(queued.status_url, ep.base) : null;
  const responseUrl = queued?.response_url ? viaGateway(queued.response_url, ep.base) : null;
  const cancelUrl = queued?.cancel_url ? viaGateway(queued.cancel_url, ep.base) : null;
  if (!statusUrl || !responseUrl) { if (pickUrl(queued)) return queued; throw new Error('网关返回的任务信息不完整'); }
  const cancel = () => { if (cancelUrl) fetch(cancelUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + ep.token } }).catch(() => {}); };
  const taskId = meta ? uid('t') : null;
  if (meta && taskId) registerTask({ id: taskId, kind: meta.kind, provider: 'fal', name: meta.name, group: meta.group, prompt: meta.prompt, model: meta.model, createdAt: Date.now(), statusUrl, responseUrl, cancelUrl: cancelUrl || undefined, ...(meta.ref || {}), state: 'running' });
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
  } catch (e) { cancel(); finishTask(taskId); throw e; }
  const done = await fetch(responseUrl, { headers: { Authorization: 'Bearer ' + ep.token }, signal });
  finishTask(taskId);
  if (!done.ok) throw new Error('读取生成结果失败：' + await readError(done));
  return done.json();
}

// ===== 火山方舟 =====
// 方舟同构接口：火山方舟走 /ark，BytePlus ModelArk 走 /byteplus，请求与返回结构相同
type ArkLike = 'ark' | 'byteplus';
const arkSite = (p: ArkLike) => p === 'byteplus' ? 'BytePlus' : '火山方舟';
const arkLikeOf = (p: string | undefined): ArkLike => p === 'byteplus' ? 'byteplus' : 'ark';
async function arkFetch(path: string, init: RequestInit & { signal?: AbortSignal } = {}, provider: ArkLike = 'ark'): Promise<any> {
  const ep = mediaEndpoint(); if (!ep) throw new Error(mediaReadyReason() || '网关未配置');
  const site = arkSite(provider);
  const res = await fetch(`${ep.base}/${provider}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ep.token, ...(init.headers || {}) } });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) {
    const err = data?.error || {};
    const out: any = new Error(err.code === 'ModelNotOpen' ? `这个模型还没在${site}控制台开通，去「开通管理」里开通后即可使用` : err.code === 'AccountOverdueError' ? `${site}账户余额不足，请先充值` : `${site}返回错误：` + (err.message || `HTTP ${res.status}`));
    out.code = err.code || ('HTTP_' + res.status); throw out;
  }
  return data;
}
// 方舟视频：创建任务 → 轮询 → 拿 video_url；中途停止会删掉任务
async function runArkVideo(model: string, content: unknown[], { onProgress, signal }: GenOptions, timeoutMs: number, meta?: TaskMeta, provider: ArkLike = 'ark'): Promise<string> {
  const af = (path: string, init?: RequestInit & { signal?: AbortSignal }) => arkFetch(path, init, provider);
  const created = await af('/contents/generations/tasks', { method: 'POST', body: JSON.stringify({ model, content }), signal });
  const id = created?.id; if (!id) throw new Error('火山方舟没有返回任务 id');
  const taskId = meta ? uid('t') : null;
  if (meta && taskId) registerTask({ id: taskId, kind: meta.kind, provider, name: meta.name, group: meta.group, prompt: meta.prompt, model: meta.model, createdAt: Date.now(), arkTaskId: String(id), ...(meta.ref || {}), state: 'running' });
  const started = Date.now();
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('已停止', 'AbortError');
      if (Date.now() - started > timeoutMs) throw new Error('生成超时，任务可能仍在队列里，请稍后重试');
      await sleep(2000);
      const task = await af(`/contents/generations/tasks/${encodeURIComponent(id)}`, { signal });
      const status = String(task?.status || '');
      if (status === 'succeeded') { const url = task?.content?.video_url; if (!url) throw new Error('生成结果里没有视频地址'); finishTask(taskId); return url; }
      if (status === 'failed' || status === 'cancelled') throw new Error('生成失败：' + (task?.error?.message || status));
      const secs = Math.round((Date.now() - started) / 1000);
      onProgress?.(status === 'queued' ? `排队中 · ${secs}s` : `生成中 · ${secs}s`);
    }
  } catch (e) {
    af(`/contents/generations/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    finishTask(taskId);
    throw e;
  }
}

// ===== 页面重新打开后接着轮询落盘的任务（每个项目的 moodio-tasks 键），完成后入库并补回计划卡 =====
const authHeaders = (ep: MediaEndpoint) => ({ Authorization: 'Bearer ' + ep.token });
async function resumeOne(t: GenTask) {
  const ep = mediaEndpoint(); if (!ep) return;
  const ref: TaskRef = { chatId: t.chatId, messageAt: t.messageAt, stepIndex: t.stepIndex };
  try {
    let url: string | undefined, contentType: string | undefined; let extra: Partial<MediaItem> = {};
    const deadline = t.createdAt + 30 * 60e3;
    if (t.provider === 'fal') {
      for (;;) {
        if (Date.now() > deadline) throw new Error('等待超过 30 分钟，放弃');
        const res = await fetch(t.statusUrl!, { headers: authHeaders(ep) }); if (!res.ok) throw new Error('查询状态失败：' + await readError(res));
        const st = await res.json(); const phase = String(st?.status || '');
        if (phase === 'COMPLETED') break;
        if (phase === 'FAILED' || phase === 'ERROR') throw new Error('生成失败：' + (st?.error || phase));
        await sleep(5000);
      }
      const done = await fetch(t.responseUrl!, { headers: authHeaders(ep) }); if (!done.ok) throw new Error('读取结果失败：' + await readError(done));
      const data = await done.json(); const hit = pickUrl(data); if (!hit) throw new Error('结果里没有文件地址'); url = hit.url; contentType = hit.contentType; if (t.kind === 'audio') extra = audioExtra(data);
    } else {
      for (;;) {
        if (Date.now() > deadline) throw new Error('等待超过 30 分钟，放弃');
        const task = await arkFetch(`/contents/generations/tasks/${encodeURIComponent(t.arkTaskId || '')}`, undefined, arkLikeOf(t.provider));
        const status = String(task?.status || '');
        if (status === 'succeeded') { url = task?.content?.video_url; if (!url) throw new Error('结果里没有视频地址'); break; }
        if (status === 'failed' || status === 'cancelled') throw new Error('生成失败：' + (task?.error?.message || status));
        await sleep(5000);
      }
    }
    const item = await storeResult(url!, { name: t.name, group: t.group, kind: t.kind, contentType, model: t.model, extra });
    useTasks.getState().remove(t.id);
    patchStep(ref, 'done', `后台完成：已生成「${item.name}」`, { id: item.id, kind: t.kind, name: item.name, prompt: t.prompt });
    toast(`后台任务完成：「${item.name}」`, { label: '查看', onClick: () => useFiles.getState().openInPane(item.id) });
  } catch (e: any) {
    useTasks.getState().remove(t.id);
    patchStep(ref, 'failed', `后台任务失败：${e?.message || e}`);
    toast(`后台任务「${t.name}」失败：${e?.message || e}`);
  }
}
const resuming = new Set<string>();
export function resumeTasks() {
  for (const t of runningTasks()) { if (resuming.has(t.id)) continue; resuming.add(t.id); void resumeOne(t).finally(() => resuming.delete(t.id)); }
}
// 取消一个后台任务：通知上游、从列表移除、计划卡那一步标失败
export async function cancelTask(id: string) {
  const t = useTasks.getState().tasks.find(x => x.id === id); if (!t) return;
  const ep = mediaEndpoint();
  try { if (t.provider === 'fal' && t.cancelUrl && ep) await fetch(t.cancelUrl, { method: 'PUT', headers: authHeaders(ep) }); else if (t.arkTaskId) await arkFetch(`/contents/generations/tasks/${encodeURIComponent(t.arkTaskId)}`, { method: 'DELETE' }, arkLikeOf(t.provider)); } catch { /* ignore */ }
  useTasks.getState().remove(id);
  patchStep({ chatId: t.chatId, messageAt: t.messageAt, stepIndex: t.stepIndex }, 'failed', '已取消');
}

// 把结果地址下载进媒体库（经网关代下载，避免跨域）
async function storeResult(url: string, { name, group, kind, contentType, model, extra }: { name: string; group: string; kind: 'image' | 'video' | 'audio'; contentType?: string; model?: string; extra?: Partial<MediaItem> }): Promise<MediaItem> {
  const ep = mediaEndpoint(); if (!ep) throw new Error('网关未配置');
  const res = await fetch(`${ep.base}/media?url=${encodeURIComponent(url)}`, { headers: { Authorization: 'Bearer ' + ep.token } });
  if (!res.ok) throw new Error('下载生成结果失败：' + await readError(res));
  const blob = await res.blob();
  const mime = contentType || blob.type || (kind === 'image' ? 'image/png' : kind === 'audio' ? 'audio/mpeg' : 'video/mp4');
  const rawExt = (mime.split('/')[1] || (kind === 'image' ? 'png' : kind === 'audio' ? 'mp3' : 'mp4')).replace(/[^a-z0-9]/gi, '').slice(0, 4);
  const ext = rawExt === 'mpeg' ? 'mp3' : rawExt;
  const id = uid('m');
  await putBlob(id, blob); cacheUrl(id, blob);
  const size = kind === 'image' ? await imageSize(blob) : null;
  const finalName = /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.${ext}`;
  const meta: MediaItem = { id, name: finalName, kind, mime, size: blob.size, group, createdAt: Date.now(), by: 'agent', width: size?.width, height: size?.height, model, ...(extra || {}) };
  useFiles.getState().addMedia(meta);
  return meta;
}

export interface GenResult { item: MediaItem; model: ModelPreset; skipped: { model: ModelPreset; reason: string }[]; }
export function fallbackNote(r: GenResult): string { return r.skipped.length ? `（${r.skipped.map(s => `${s.model.name}${s.reason}`).join('、')}，改用 ${r.model.name}）` : ''; }

// 状态气泡里带上正在用的模型；换过模型时把跳过的原因一起挂着，用户能看到「Seedance 2.0（Seedance 2.5 未开通）· 生成中 · 12s」
function labelled(kind: ModelKind, id: string, opts: GenOptions & { _skipped?: string[] }): GenOptions {
  const sk = opts._skipped || [];   // 气泡放不下整串原因：只写第一个，其余记个数；完整清单在结果文案 fallbackNote() 里
  const label = modelDisplayName(kind, id) + (sk.length === 1 ? `（${sk[0]}）` : sk.length > 1 ? `（${sk[0]} 等 ${sk.length} 个不可用）` : '');
  return { ...opts, onProgress: t => opts.onProgress?.(`${label} · ${t}`) };
}
function skipNote(kind: ModelKind, opts: GenOptions & { _skipped?: string[] }) {
  return (id: string, reason: string) => { (opts._skipped ||= []).push(`${modelDisplayName(kind, id)} ${reason}`); };
}

export interface ImageRequest { prompt: string; name?: string; group?: string; ratio?: RatioKey; model?: string; }
export async function generateImage(req: ImageRequest, opts: GenOptions = {}): Promise<GenResult> {
  const prompt = String(req.prompt || '').trim(); if (!prompt) throw new Error('缺少画面描述');
  const cfg = modelCfg();
  const wanted = req.model || currentImageModel(cfg);
  const chain = modelChain('image', wanted);
  const run = await runWithFallback(chain, (id) => generateImageWith(id, prompt, req, cfg, labelled('image', id, opts)), skipNote('image', opts));
  const skipped = run.skipped.map(s => ({ model: presetFor(IMAGE_MODELS, s.model, 'image'), reason: s.reason }));
  return { item: run.result, model: presetFor(IMAGE_MODELS, run.model, 'image'), skipped };
}
async function generateImageWith(model: string, prompt: string, req: ImageRequest, cfg: ModelConfig | null, opts: GenOptions): Promise<MediaItem> {
  const preset = presetFor(IMAGE_MODELS, model, 'image');
  const ratio = (req.ratio || cfg?.imageRatio || MEDIA_DEFAULTS.imageRatio) as RatioKey;
  opts.onProgress?.('提交生成任务…');
  let url: string, contentType: string | undefined;
  if (isArkLike(preset.provider)) {
    const started = Date.now();   // 方舟出图是一次同步调用，自己报个计时，别让状态一直停在「提交」
    const ticking = setInterval(() => opts.onProgress?.(`生成中 · ${Math.round((Date.now() - started) / 1000)}s`), 1000);
    try {
      const data = await arkFetch('/images/generations', { method: 'POST', body: JSON.stringify({ model, prompt, size: arkImageSize(ratio, cfg?.imageResolution || MEDIA_DEFAULTS.imageResolution), response_format: 'url', watermark: false }), signal: opts.signal }, arkLikeOf(preset.provider));
      url = data?.data?.[0]?.url; if (!url) throw new Error('生成结果里没有图片地址');
    } finally { clearInterval(ticking); }
  } else {
    const result = await runFal(model, buildInput(preset, prompt, { ratio }), opts, 4 * 60e3, { kind: 'image', name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', prompt, model: preset.name, ref: opts.task });
    const hit = pickUrl(result); if (!hit) throw new Error('生成结果里没有图片地址');
    url = hit.url; contentType = hit.contentType;
  }
  opts.onProgress?.('下载生成结果…');
  return storeResult(url, { name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', kind: 'image', contentType, model: preset.name });
}

export interface VideoRequest { prompt: string; name?: string; group?: string; ratio?: RatioKey; duration?: string | number; fromMediaId?: string; toMediaId?: string; model?: string; }   // toMediaId = 尾帧图，只发给收首尾帧的模型
export async function generateVideo(req: VideoRequest, opts: GenOptions = {}): Promise<GenResult> {
  const prompt = String(req.prompt || '').trim(); if (!prompt) throw new Error('缺少画面描述');
  const cfg = modelCfg();
  const fromImage = !!req.fromMediaId;
  const kind: ModelKind = fromImage ? 'videoImage' : 'video';
  const list = fromImage ? VIDEO_IMAGE_MODELS : VIDEO_MODELS;
  const wanted = req.model || (fromImage ? currentVideoImageModel(cfg) : currentVideoModel(cfg));
  const chain = modelChain(kind, wanted);
  const run = await runWithFallback(chain, (id) => generateVideoWith(id, prompt, req, cfg, labelled(kind, id, opts)), skipNote(kind, opts));
  try { localStorage.setItem(LAST_VIDEO_KEY, run.model); } catch { /* ignore */ }   // 生成策略下次按这个模型的能力来定
  const skipped = run.skipped.map(s => ({ model: presetFor(list, s.model, kind), reason: s.reason }));
  return { item: run.result, model: presetFor(list, run.model, kind), skipped };
}
async function generateVideoWith(model: string, prompt: string, req: VideoRequest, cfg: ModelConfig | null, opts: GenOptions): Promise<MediaItem> {
  const fromImage = !!req.fromMediaId;
  const preset = presetFor(fromImage ? VIDEO_IMAGE_MODELS : VIDEO_MODELS, model, fromImage ? 'videoImage' : 'video');
  // 时长：请求里明确给了就用它；否则按设置——智能时长按提示词长度估，自定义用滑杆的值；最后收敛到模型允许的档位 / 范围
  const explicit = String(req.duration ?? '').replace(/[^0-9]/g, '');
  const duration = String(explicit ? resolveDuration(preset, 'custom', explicit, prompt) : resolveDuration(preset, cfg?.durationMode === 'custom' ? 'custom' : 'smart', cfg?.videoDuration || MEDIA_DEFAULTS.videoDuration, prompt));
  opts.onProgress?.(`时长 ${duration} 秒`);
  const ratio = (req.ratio || cfg?.videoRatio || MEDIA_DEFAULTS.videoRatio) as RatioKey;
  const resolution = cfg?.videoResolution || MEDIA_DEFAULTS.videoResolution;
  const imageDataUrl = fromImage ? await imageDataUrlOf(req.fromMediaId!) : '';
  const lastDataUrl = fromImage && req.toMediaId && preset.keyframes === 'both' ? await imageDataUrlOf(req.toMediaId) : '';   // 尾帧只发给收首尾帧的模型
  opts.onProgress?.('提交生成任务…');
  let url: string, contentType: string | undefined;
  if (isArkLike(preset.provider)) {
    const text = arkPromptArgs(preset, prompt, { ratio: fromImage ? undefined : ratio, duration, resolution });
    const content = arkVideoContent(text, imageDataUrl, lastDataUrl);
    url = await runArkVideo(model, content, opts, 12 * 60e3, { kind: 'video', name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', prompt, model: preset.name, ref: opts.task }, arkLikeOf(preset.provider));
  } else {
    const input = buildInput(preset, prompt, { ratio: fromImage ? undefined : ratio, duration });
    if (imageDataUrl) input.image_url = imageDataUrl; if (lastDataUrl) input.tail_image_url = lastDataUrl;
    const result = await runFal(model, input, opts, 12 * 60e3, { kind: 'video', name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', prompt, model: preset.name, ref: opts.task });
    const hit = pickUrl(result); if (!hit) throw new Error('生成结果里没有视频地址');
    url = hit.url; contentType = hit.contentType;
  }
  opts.onProgress?.('下载生成结果…');
  return storeResult(url, { name: sanitizeName(req.name || prompt.slice(0, 24)), group: req.group || '其他', kind: 'video', contentType, model: preset.name });
}

// 媒体库里的图片 → data URL（首帧 / 尾帧参考图随请求体发给上游）
async function imageDataUrlOf(id: string): Promise<string> {
  const src = findMedia(id); if (!src) throw new Error(`找不到 id 为「${id}」的图片`);
  if (src.kind !== 'image') throw new Error(`「${src.name}」不是图片`);
  const blob = await getBlob(src.id); if (!blob) throw new Error(`「${src.name}」的文件不在本机媒体库里`);
  return new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(new Error('读取参考图失败')); fr.readAsDataURL(blob); });
}
// 方舟视频任务的 content：文本 + 首帧图（role first_frame）+ 尾帧图（role last_frame）
export function arkVideoContent(text: string, first?: string, last?: string): unknown[] {
  const content: unknown[] = [{ type: 'text', text }];
  if (first) content.push({ type: 'image_url', image_url: { url: first }, role: 'first_frame' });
  if (last) content.push({ type: 'image_url', image_url: { url: last }, role: 'last_frame' });
  return content;
}

// 不经 Agent 的手动生成（输入框「+」菜单）：占用同一套忙碌状态与流光，可用胶囊上的「停止」中断
export async function manualGenerate(kind: 'image' | 'video', req: ImageRequest & VideoRequest): Promise<GenResult> {
  const agent = useAgent.getState();
  if (agent.busy) throw new Error('上一个任务还在执行，等它完成或点「停止」');
  const reason = mediaReadyReason(); if (reason) throw new Error(reason);
  const controller = new AbortController();
  agent.set({ busy: true, glow: true, abortRequested: false, controller, live: '提交生成任务…' });
  const opts: GenOptions = { signal: controller.signal, onProgress: text => useAgent.getState().set({ live: text }) };
  try {
    const result = kind === 'image' ? await generateImage(req, opts) : await generateVideo(req, opts);
    useFiles.getState().openInPane(result.item.id);   // 生成完直接在工作区打开，和 Agent 生成时的行为一致
    return result;
  }
  finally { useAgent.getState().set({ busy: false, glow: false, live: '', controller: null }); }
}

// ===== 声音：fal 上的 MiniMax——设计音色样本（voice-design）与合成旁白 / 台词（speech）=====
// 音色样本是「一段试听 + voice id」：试听进媒体库当样本（台账实体的 voice 指向它），voice id 存在媒体项的 voiceId 上，合成配音时带上它。
const hasCJK = (s: string) => /[\u3400-\u9fff]/.test(s);
// 结果里的额外字段：设计音色返回 custom_voice_id，合成语音返回 duration_ms（后台恢复的任务也走这里）
function audioExtra(data: any): Partial<MediaItem> {
  const out: Partial<MediaItem> = {};
  if (typeof data?.custom_voice_id === 'string' && data.custom_voice_id) out.voiceId = data.custom_voice_id;
  const ms = Number(data?.duration_ms); if (Number.isFinite(ms) && ms > 0) out.duration = Math.round(ms) / 1000;
  return out;
}
export interface VoiceRequest { name: string; description: string; sample: string; group?: string; }
export async function designVoice(req: VoiceRequest, opts: GenOptions = {}): Promise<GenResult> {
  const description = String(req.description || '').trim(); if (!description) throw new Error('缺少音色描述');
  const sample = String(req.sample || '').trim().slice(0, 300) || '你好，这是我的声音，很高兴见到你。';
  const name = sanitizeName(`${String(req.name || '角色').trim()}音色样本`); const group = req.group || '音色';
  const o = labelled('voice', VOICE_DESIGN_MODEL, opts);
  o.onProgress?.('提交生成任务…');
  const data = await runFal(VOICE_DESIGN_MODEL, { prompt: description, preview_text: sample }, o, 3 * 60e3, { kind: 'audio', name, group, prompt: description, model: VOICE_DESIGN_PRESET.name, ref: opts.task });
  const hit = pickUrl(data); if (!hit) throw new Error('生成结果里没有音频地址');
  const extra = audioExtra(data); if (!extra.voiceId) throw new Error('声音模型没有返回音色 id');
  o.onProgress?.('下载生成结果…');
  const item = await storeResult(hit.url, { name, group, kind: 'audio', contentType: hit.contentType, model: VOICE_DESIGN_PRESET.name, extra });
  return { item, model: VOICE_DESIGN_PRESET, skipped: [] };
}

export interface SpeechRequest { text: string; voiceId?: string; name?: string; group?: string; speed?: number; emotion?: string; }
export const DEFAULT_VOICE_ID = 'Wise_Woman';   // 没设计音色时的兜底：MiniMax 预置音色，中英文都能说
const EMOTIONS = new Set(['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral']);
// 只发模型认识的字段：文本、音色设置、语言增强；output_format 必须是 url（默认 hex 会把整段音频塞进 JSON）
export function buildSpeechInput(req: SpeechRequest): Record<string, unknown> {
  const text = String(req.text || '').trim();
  const speed = Math.min(2, Math.max(0.5, Number(req.speed) || 1));
  const voice_setting: Record<string, unknown> = { voice_id: String(req.voiceId || DEFAULT_VOICE_ID), speed, vol: 1, pitch: 0 };
  if (req.emotion && EMOTIONS.has(req.emotion)) voice_setting.emotion = req.emotion;
  return { prompt: text, voice_setting, language_boost: hasCJK(text) ? 'Chinese' : 'auto', output_format: 'url', audio_setting: { format: 'mp3', sample_rate: 32000, bitrate: 128000, channel: 1 } };
}
export async function generateSpeech(req: SpeechRequest, opts: GenOptions = {}): Promise<GenResult> {
  const text = String(req.text || '').trim(); if (!text) throw new Error('缺少要合成的文本');
  if (text.length > 2000) throw new Error('一次最多合成 2000 字，请分段');
  const chain = modelChain('voice', currentVoiceModel(modelCfg()));
  const run = await runWithFallback(chain, (id) => generateSpeechWith(id, text, req, labelled('voice', id, opts)), skipNote('voice', opts));
  const skipped = run.skipped.map(s => ({ model: presetFor(VOICE_MODELS, s.model, 'voice'), reason: s.reason }));
  return { item: run.result, model: presetFor(VOICE_MODELS, run.model, 'voice'), skipped };
}
async function generateSpeechWith(model: string, text: string, req: SpeechRequest, opts: GenOptions): Promise<MediaItem> {
  const preset = presetFor(VOICE_MODELS, model, 'voice');
  const name = sanitizeName(req.name || text.slice(0, 16)); const group = req.group || '配音';
  opts.onProgress?.('提交生成任务…');
  const data = await runFal(model, buildSpeechInput({ ...req, text }), opts, 3 * 60e3, { kind: 'audio', name, group, prompt: text, model: preset.name, ref: opts.task });
  const hit = pickUrl(data); if (!hit) throw new Error('生成结果里没有音频地址');
  opts.onProgress?.('下载生成结果…');
  return storeResult(hit.url, { name, group, kind: 'audio', contentType: hit.contentType, model: preset.name, extra: { ...audioExtra(data), ...(req.voiceId ? { voiceId: req.voiceId } : {}) } });
}
