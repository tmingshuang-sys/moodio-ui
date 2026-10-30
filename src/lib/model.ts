// ===== 模型调用：Claude（Anthropic Messages API，浏览器直连）或 OpenAI 兼容 Chat Completions（默认走 WoW 网关）=====
// 两条通道都支持 {signal,onText,onReasoning} 流式回调；OpenAI 兼容通道按 cfg.thinking 发送 DeepSeek 的 thinking / reasoning_effort。
// 密钥只存 localStorage moodio-agent-model。从旧版 src/11-agent.js 移植，逻辑保持一致。
import type { ModelConfig } from './types';

export const MODEL_KEY = 'moodio-agent-model';
export const PROVIDER_DEFAULTS = {
  claude: { baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5', placeholder: 'sk-ant-...' },
  openai: { baseUrl: 'https://moodio-gateway.moodio-ui.workers.dev/v1', model: 'deepseek-flash', placeholder: '访问口令（或该服务的 API Key）' },
} as const;

export function modelCfg(): ModelConfig | null { try { return JSON.parse(localStorage.getItem(MODEL_KEY) || 'null'); } catch { return null; } }
export function saveModelCfg(cfg: ModelConfig | null) { if (cfg) localStorage.setItem(MODEL_KEY, JSON.stringify(cfg)); else localStorage.removeItem(MODEL_KEY); window.dispatchEvent(new CustomEvent('moodio:model-changed')); }
export function modelProvider(cfg: ModelConfig | null | undefined): 'claude' | 'openai' { return cfg?.provider || (String(cfg?.apiKey || '').startsWith('sk-ant-') ? 'claude' : 'openai'); }
export function modelLabel(cfg: ModelConfig | null | undefined): string { if (!cfg?.apiKey) return '未连接模型'; const p = modelProvider(cfg); return `${p === 'claude' ? 'Claude' : 'OpenAI 兼容'} · ${isAutoModel(cfg) ? '智能匹配' : cfg.model || PROVIDER_DEFAULTS[p].model}`; }
// 写作模型分工：创意类请求用写作模型（设置里单独指定），其余用默认模型
const CREATIVE_RE = /(写|续写|改写|润色|扩写|重写|台词|对白|一场|整集|一集|脚本|广告|短片|大纲|梗概|节拍|小传|设定|风格|分镜|提示词|prompt)/i;
export function isCreativeRequest(text: string): boolean { const t = String(text || ''); return CREATIVE_RE.test(t) && !/^(删除|重命名|导出|切换|打开|列出|读取|恢复|合并)/.test(t.trim()); }
export function writerCfg(cfg: ModelConfig): ModelConfig { const model = String(cfg.writerModel || '').trim(); if (!model) return cfg; return { ...cfg, model, thinking: cfg.writerThinking || cfg.thinking }; }

// ===== 推理（对话）模型目录：都经 WoW 网关，按模型名分流到 DeepSeek 或 Moonshot =====
export interface ChatPreset { id: string; name: string; hint: string; vendor: 'DeepSeek' | 'Kimi'; verified?: boolean; vision?: boolean; }
export const CHAT_AUTO_ID = 'auto';
export const CHAT_MODELS: ChatPreset[] = [
  { id: 'deepseek-flash', name: 'DeepSeek Flash', hint: '快、便宜，日常对话与规划', vendor: 'DeepSeek', verified: true },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', hint: '写作质量更高，适合剧本与文案', vendor: 'DeepSeek' },
  { id: 'kimi-k3', name: 'Kimi K3', hint: 'Moonshot 旗舰，支持看图与长上下文', vendor: 'Kimi', verified: true, vision: true },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', hint: 'Moonshot 上一代', vendor: 'Kimi' },
];
export type ChatKind = 'plan' | 'write' | 'compile' | 'vision';   // compile：分镜 / 片段提示词这类结构化编译，用强模型但低温度
// 智能匹配的候选链：规划用快的，写作与编译用强的，看图用能看图的；前一个不可用（未配置 / 不存在）就换下一个
export const CHAT_AUTO: Record<ChatKind, string[]> = {
  plan: ['deepseek-flash', 'kimi-k3', 'deepseek-v4-pro'],
  write: ['deepseek-v4-pro', 'kimi-k3', 'deepseek-flash'],
  compile: ['deepseek-v4-pro', 'kimi-k3', 'deepseek-flash'],
  vision: ['kimi-k3'],
};
// 温度按用途：规划与编译要稳，写作要有创造力，看图要准
export const CHAT_TEMPERATURE: Record<ChatKind, number> = { plan: 0.3, compile: 0.4, write: 0.7, vision: 0.2 };
export function isAutoModel(cfg: ModelConfig | null | undefined): boolean { const m = String(cfg?.model || '').trim(); return !m || m === CHAT_AUTO_ID; }
export function isMoodioGateway(cfg: ModelConfig | null | undefined): boolean { return modelProvider(cfg) === 'openai' && (!cfg?.baseUrl || /moodio-gateway|workers\.dev/i.test(String(cfg.baseUrl))); }
export function chatModelName(id: string | undefined): string { return isAutoModel({ model: id }) ? '智能匹配' : CHAT_MODELS.find(m => m.id === id)?.name || String(id); }
// 按用途取实际要调的配置：候选链放在 candidates 里，callModel 遇到「模型不可用」就换下一个
export function chatCfg(cfg: ModelConfig, kind: ChatKind): ModelConfig & { candidates?: string[] } {
  const temperature = CHAT_TEMPERATURE[kind];
  if (kind === 'vision') { const v = visionCfg(cfg); return v ? { ...v, temperature } : cfg; }
  const creative = kind === 'write' || kind === 'compile';
  if (creative && String(cfg.writerModel || '').trim()) return { ...writerCfg(cfg), temperature };
  if (!isAutoModel(cfg) || modelProvider(cfg) === 'claude') return { ...(creative ? writerCfg(cfg) : cfg), temperature };
  const chain = CHAT_AUTO[kind];
  return { ...cfg, model: chain[0], candidates: chain, thinking: creative ? (cfg.writerThinking || cfg.thinking) : cfg.thinking, temperature };
}
const MODEL_UNAVAILABLE_RE = /返回 (404|503)|not exist|not found|不存在|未配置|无法用|invalid model|model_not_found|does not exist/i;
// 旧配置里存的是默认的具体模型名：第一次带智能匹配的版本启动时改成智能匹配（只做一次），之后用户手选的不再改
(() => { try { if (typeof localStorage === 'undefined' || localStorage.getItem('moodio-chat-prefs-v2')) return; const cfg = modelCfg(); if (cfg && modelProvider(cfg) === 'openai' && (!cfg.model || cfg.model === PROVIDER_DEFAULTS.openai.model)) localStorage.setItem(MODEL_KEY, JSON.stringify({ ...cfg, model: CHAT_AUTO_ID })); localStorage.setItem('moodio-chat-prefs-v2', '1'); } catch { /* ignore */ } })();

export interface CallOptions { signal?: AbortSignal; onText?: (text: string) => void; onReasoning?: (text: string) => void; images?: string[]; }   // images：data URL，交给支持图片输入的模型

// 看图用哪个模型：设置里填了视觉模型就用它；没填时主模型本身支持图片输入（Kimi K3 / Claude / GPT-4o 等）就直接用主模型
const VISION_RE = /kimi|moonshot|vision|\bvl\b|gpt-4o|gpt-5|claude|gemini|glm-4v/i;
export function visionCfg(cfg: ModelConfig | null | undefined): ModelConfig | null {
  if (!cfg?.apiKey) return null;
  const m = String(cfg.visionModel || '').trim();
  if (m) return { ...cfg, model: m, thinking: '' };
  if (!isAutoModel(cfg) && VISION_RE.test(String(cfg.model || ''))) return { ...cfg, thinking: '' };
  if (isAutoModel(cfg) && isMoodioGateway(cfg)) return { ...cfg, model: CHAT_AUTO.vision[0], thinking: '' };   // 智能匹配：走网关时用 Kimi K3 看图
  return null;
}
// OpenAI 兼容格式的用户消息：有图片时用 content 数组（文本 + image_url）
export function openAIUserContent(t: string, images?: string[]): string | { type: string; text?: string; image_url?: { url: string } }[] {
  if (!images?.length) return t;
  return [{ type: 'text', text: t }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))];
}
const dataUrlParts = (url: string) => { const m = /^data:([^;,]+);base64,(.*)$/s.exec(url); return m ? { mime: m[1], data: m[2] } : null; };

async function readModelError(res: Response): Promise<Error> { let msg = ''; try { const j: any = await res.json(); msg = j.error?.message || j.error?.type || ''; } catch { /* ignore */ } return new Error('模型服务返回 ' + res.status + (msg ? '：' + msg : '')); }

// Claude 流式：SSE 逐段返回文本，thinking 摘要单独回传给 onReasoning
async function readClaudeStream(res: Response, { signal, onText, onReasoning }: CallOptions): Promise<string> {
  const reader = res.body!.getReader(), decoder = new TextDecoder('utf-8');
  const limit = 2 * 1024 * 1024;
  let buffer = '', text = '', thinking = '', stop: string | null = null, done = false, eventName = '', dataLines: string[] = [];
  const onAbort = () => { try { reader.cancel(signal?.reason).catch(() => {}); } catch { /* ignore */ } };
  signal?.addEventListener('abort', onAbort, { once: true });
  const consume = () => {
    if (!dataLines.length) { eventName = ''; return; }
    const payload = dataLines.join('\n'); dataLines = []; const name = eventName; eventName = '';
    let data: any; try { data = JSON.parse(payload); } catch { throw new Error('模型返回的流式内容无法解析，结果不完整。请重试。'); }
    const type = data?.type || name;
    if (type === 'error') throw new Error('模型服务返回错误：' + (data.error?.message || data.error?.type || '请求失败'));
    if (type === 'content_block_delta') {
      const d = data.delta || {};
      if (d.type === 'text_delta' && typeof d.text === 'string') { if (text.length + d.text.length > limit) throw new Error('模型输出超过可处理的长度上限，请缩短内容后重试。'); text += d.text; onText?.(text); }
      else if (d.type === 'thinking_delta' && typeof d.thinking === 'string' && typeof onReasoning === 'function') { if (thinking.length < limit) { thinking += d.thinking; onReasoning(thinking); } }
    } else if (type === 'message_delta') { stop = data.delta?.stop_reason || stop; }
    else if (type === 'message_stop') { done = true; }
  };
  try {
    while (!done) {
      if (signal?.aborted) throw signal.reason || new DOMException('请求已停止', 'AbortError');
      const part = await reader.read();
      buffer += decoder.decode(part.value || new Uint8Array(), { stream: !part.done });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        let line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1); if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line) { consume(); continue; }
        if (line[0] === ':') continue;
        const colon = line.indexOf(':'); const field = colon < 0 ? line : line.slice(0, colon); let value = colon < 0 ? '' : line.slice(colon + 1); if (value[0] === ' ') value = value.slice(1);
        if (field === 'event') eventName = value; else if (field === 'data') dataLines.push(value);
        if (done) break;
      }
      if (part.done) { if (buffer.trim()) { dataLines.push(buffer.trim()); buffer = ''; } consume(); break; }
    }
    if (signal?.aborted) throw signal.reason || new DOMException('请求已停止', 'AbortError');
    if (stop === 'refusal') throw new Error('模型拒绝了这次请求');
    if (stop === 'max_tokens') throw new Error('模型输出达到长度上限，结果不完整。请缩短内容或调整模型后重试。');
    if (!done && !text) throw new Error('模型输出中断，结果不完整。请重试。');
    return text;
  } finally { signal?.removeEventListener('abort', onAbort); try { reader.releaseLock(); } catch { /* ignore */ } }
}

export async function callClaude(cfg: ModelConfig, sys: string, t: string, { signal, onText, onReasoning, images }: CallOptions = {}): Promise<string> {
  const base = (cfg.baseUrl || PROVIDER_DEFAULTS.claude.baseUrl).replace(/\/+$/, '').replace(/\/v1$/, '');
  const model = cfg.model || PROVIDER_DEFAULTS.claude.model, streaming = typeof onText === 'function';
  const imageBlocks = (images || []).map(dataUrlParts).filter(Boolean).map(p => ({ type: 'image', source: { type: 'base64', media_type: p!.mime, data: p!.data } }));
  const body: any = { model, max_tokens: 16000, system: sys, fallbacks: 'default', output_config: { effort: 'medium' }, messages: [{ role: 'user', content: imageBlocks.length ? [...imageBlocks, { type: 'text', text: t }] : t }] };
  if (/(?:-4-[678]|-5)(?:-|$)|fable|mythos/i.test(model)) body.thinking = { type: 'adaptive', display: 'summarized' };   // 4.6 及之后支持 adaptive thinking
  if (streaming) body.stream = true;
  const res = await fetch(base + '/v1/messages', { method: 'POST', signal, headers: {
    'Content-Type': 'application/json', 'x-api-key': cfg.apiKey || '', 'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',   // 允许浏览器直连；密钥只在本机
    'anthropic-beta': 'server-side-fallback-2026-07-01',
  }, body: JSON.stringify(body) });
  if (!res.ok) throw await readModelError(res);
  if (streaming && /text\/event-stream/i.test(res.headers?.get('content-type') || '') && res.body?.getReader) return readClaudeStream(res, { signal, onText, onReasoning });
  const data: any = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('模型拒绝了这次请求' + (data.stop_details?.explanation ? '：' + data.stop_details.explanation : ''));
  if (data.stop_reason === 'max_tokens') throw new Error('模型输出达到长度上限，结果不完整。请缩短内容或调整模型后重试。');
  const thinking = (data.content || []).filter((b: any) => b.type === 'thinking' && b.thinking).map((b: any) => b.thinking).join('\n');
  if (thinking && typeof onReasoning === 'function') onReasoning(thinking);
  const text = (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  if (streaming) onText!(text);
  return text;
}

async function readOpenAIStream(res: Response, { signal, onText, onReasoning }: CallOptions): Promise<string> {
  const reader = res.body!.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  const eventLimit = 1024 * 1024, textLimit = 2 * 1024 * 1024, transferLimit = 8 * 1024 * 1024;
  let buffer = '', eventData: string[] = [], eventSize = 0, content = '', reasoning = '', received = 0, finished = false, doneMarker = false, sourceEnded = false, canceled = false, abortFailure: any = null, rejectAbort: (e: any) => void = () => {};
  const abortPromise = new Promise<never>((_, reject) => { rejectAbort = reject; }); abortPromise.catch(() => {});
  const cancelReader = (reason?: any) => { if (canceled || sourceEnded) return; canceled = true; try { reader.cancel(reason).catch(() => {}); } catch { /* ignore */ } };
  const onAbort = () => { abortFailure = signal?.reason || new DOMException('请求已停止', 'AbortError'); rejectAbort(abortFailure); cancelReader(abortFailure); };
  const incomplete = () => new Error('模型输出中断，结果不完整。请重试。');
  const consumeEvent = () => {
    if (abortFailure) throw abortFailure;
    if (!eventData.length) return;
    const payload = eventData.join('\n'); eventData = []; eventSize = 0;
    if (payload.trim() === '[DONE]') { if (!finished) throw incomplete(); doneMarker = true; return; }
    let data: any; try { data = JSON.parse(payload); } catch { throw new Error('模型返回的流式内容无法解析，结果不完整。请重试。'); }
    if (data?.error) throw new Error('模型服务返回错误：' + (data.error.message || data.error.type || '请求失败'));
    const choice = data?.choices?.[0]; if (!choice) return;
    const delta = choice.delta || {}, reason = choice.finish_reason;
    if (delta.refusal || reason === 'content_filter') throw new Error('模型未能处理这次请求，请检查内容或更换模型后重试。');
    if (reason === 'length') throw new Error('模型输出达到长度上限，结果不完整。请缩短内容或调整模型后重试。');
    if (reason && reason !== 'stop') throw new Error('模型未能完整输出结果，请重试。');
    if (typeof onReasoning === 'function' && typeof delta.reasoning_content === 'string' && delta.reasoning_content) { if (reasoning.length < textLimit) { reasoning += delta.reasoning_content; onReasoning(reasoning); } }
    if (typeof delta.content === 'string' && delta.content) {
      if (finished) throw incomplete();
      if (content.length + delta.content.length > textLimit) throw new Error('模型输出超过可处理的长度上限，请缩短内容后重试。');
      content += delta.content; onText!(content); if (abortFailure) throw abortFailure;
    }
    if (reason === 'stop') finished = true;
  };
  const consumeLine = (line: string) => {
    if (!line) { consumeEvent(); return; }
    if (line[0] === ':') return;
    const colon = line.indexOf(':'), field = colon < 0 ? line : line.slice(0, colon);
    if (field !== 'data') return;
    let value = colon < 0 ? '' : line.slice(colon + 1); if (value[0] === ' ') value = value.slice(1);
    eventSize += value.length + 1; if (eventSize > eventLimit) throw new Error('模型返回的数据片段过大，请重试。');
    eventData.push(value);
  };
  const consumeBuffer = (flush: boolean) => {
    let cursor = 0;
    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i]; if (ch !== '\r' && ch !== '\n') continue;
      if (ch === '\r' && i === buffer.length - 1 && !flush) break;
      consumeLine(buffer.slice(cursor, i));
      if (ch === '\r' && buffer[i + 1] === '\n') i++;
      cursor = i + 1; if (doneMarker) break;
    }
    buffer = buffer.slice(cursor);
    if (buffer.length > eventLimit) throw new Error('模型返回的数据片段过大，请重试。');
    if (flush && !doneMarker) { if (buffer) { consumeLine(buffer); buffer = ''; } consumeEvent(); }
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal?.aborted) onAbort();
    while (!doneMarker) {
      if (abortFailure) throw abortFailure;
      const part = await Promise.race([reader.read(), abortPromise]);
      if (abortFailure) throw abortFailure;
      sourceEnded = part.done;
      if (part.value) { received += part.value.byteLength; if (received > transferLimit) throw new Error('模型响应超过可处理的长度上限，请缩短内容后重试。'); }
      buffer += decoder.decode(part.value, { stream: !part.done }); consumeBuffer(part.done);
      if (part.done) break;
    }
    if (abortFailure) throw abortFailure;
    if (!doneMarker || !finished) throw incomplete();
    return content;
  } finally { signal?.removeEventListener('abort', onAbort); cancelReader(); try { reader.releaseLock(); } catch { /* ignore */ } }
}

// 有的模型（Kimi K3）不接受 temperature（只允许 1）：第一次被拒就去掉重发一次，并记住这个模型以后不再发
const NO_TEMPERATURE = new Set<string>();
export const rejectsTemperature = (message: string) => /temperature/i.test(String(message || ''));
export async function callOpenAI(cfg: ModelConfig, sys: string, t: string, { signal, onText, onReasoning, images }: CallOptions = {}): Promise<string> {
  const streaming = typeof onText === 'function';
  const model = cfg.model || PROVIDER_DEFAULTS.openai.model;
  const body: any = { model, temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: openAIUserContent(t, images) }], response_format: { type: 'json_object' } };   // 不发 max_tokens：思考型模型会把思维链算进上限，固定 8192 曾把写剧本那一轮截断
  const think = String(cfg.thinking || '');
  if (think === 'off') body.thinking = { type: 'disabled' };
  else if (['low', 'high', 'max'].includes(think)) { body.thinking = { type: 'enabled' }; body.reasoning_effort = think; delete body.temperature; }
  if (NO_TEMPERATURE.has(model)) delete body.temperature;
  if (streaming) body.stream = true;
  const url = (cfg.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl).replace(/\/+$/, '') + '/chat/completions';
  const post = () => fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (cfg.apiKey || '') }, body: JSON.stringify(body) });
  let res = await post();
  if (!res.ok) {
    const err = await readModelError(res);
    if (body.temperature === undefined || !rejectsTemperature(err.message)) throw err;
    NO_TEMPERATURE.add(model); delete body.temperature; res = await post();
    if (!res.ok) throw await readModelError(res);
  }
  if (streaming && !/\bjson\b/i.test(res.headers?.get('content-type') || '') && res.body?.getReader) return readOpenAIStream(res, { signal, onText, onReasoning });
  const data: any = await res.json();
  if (streaming && data.error) throw new Error('模型服务返回错误：' + (data.error.message || data.error.type || '请求失败'));
  if (data.choices?.[0]?.finish_reason === 'length') throw new Error('模型输出达到长度上限，结果不完整。请缩短内容或调整模型后重试。');
  if (data.choices?.[0]?.message?.refusal || data.choices?.[0]?.finish_reason === 'content_filter') throw new Error('模型未能处理这次请求，请检查内容或更换模型后重试。');
  if (streaming && data.choices?.[0]?.finish_reason && data.choices[0].finish_reason !== 'stop') throw new Error('模型未能完整输出结果，请重试。');
  const content = data.choices?.[0]?.message?.content || '{}';
  if (streaming) { if (signal?.aborted) throw signal.reason || new DOMException('请求已停止', 'AbortError'); onText!(content); }
  return content;
}

// 无进展超时：连续 IDLE_MS 没收到任何字节就中止（流式按每次 onText 重置），避免请求挂死让页面一直「正在思考」
const IDLE_MS = 150_000;
const TRANSIENT_RE = /超时|timed? ?out|Failed to fetch|Load failed|NetworkError|返回 (429|500|502|503|504)/i;
async function callOnce(c: ModelConfig, sys: string, t: string, opts: CallOptions): Promise<string> {
  const ctrl = new AbortController(); let timer = 0;
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(new Error('模型响应超时（150 秒无进展）')), IDLE_MS) as unknown as number; };
  const onOuter = () => ctrl.abort(opts.signal?.reason); opts.signal?.addEventListener('abort', onOuter, { once: true });
  const inner: CallOptions = { ...opts, signal: ctrl.signal, onText: opts.onText ? (x => { arm(); opts.onText!(x); }) : undefined, onReasoning: opts.onReasoning ? (x => { arm(); opts.onReasoning!(x); }) : undefined };
  arm();
  try { return modelProvider(c) === 'claude' ? await callClaude(c, sys, t, inner) : await callOpenAI(c, sys, t, inner); }
  catch (e: any) { if (ctrl.signal.aborted && !opts.signal?.aborted && ctrl.signal.reason instanceof Error) throw ctrl.signal.reason; throw e; }
  finally { clearTimeout(timer); opts.signal?.removeEventListener('abort', onOuter); }
}
export async function callModel(cfg: ModelConfig & { candidates?: string[] }, sys: string, t: string, opts: CallOptions = {}): Promise<string> {
  const chain = cfg.candidates?.length ? cfg.candidates : [cfg.model || ''];
  let lastError: any = null;
  for (let i = 0; i < chain.length; i++) {
    const c = { ...cfg, model: chain[i] || cfg.model }; delete (c as any).candidates;
    for (let attempt = 0; attempt < 2; attempt++) {   // 瞬时错误（超时 / 断网 / 5xx / 429）自动重试一次
      try { return await callOnce(c, sys, t, opts); }
      catch (e: any) {
        lastError = e;
        if (e?.name === 'AbortError' || opts.signal?.aborted) throw explainModelError(e);
        const msg = String(e?.message || '');
        if (attempt === 0 && TRANSIENT_RE.test(msg) && !MODEL_UNAVAILABLE_RE.test(msg)) { opts.onText?.(''); continue; }   // 模型不可用不重试同一个，直接换下一个
        break;
      }
    }
    if (i === chain.length - 1 || !MODEL_UNAVAILABLE_RE.test(String(lastError?.message || ''))) break;   // 只有「模型不可用」才换下一个
  }
  throw explainModelError(lastError);
}

export function explainModelError(e: any): Error {
  if (e instanceof TypeError || /Failed to fetch|Load failed|NetworkError/i.test(e?.message || '')) return new Error('未能连接模型服务。请检查网络、API 地址和服务的浏览器跨域访问设置，然后重试。');
  if (/访问口令不正确/.test(e?.message || '')) return new Error(e.message + '。WoW 网关的 API Key 位置填的是网关的访问口令，不是 DeepSeek 的 key。');
  return e instanceof Error ? e : new Error(String(e?.message || e));
}

export async function probeModel(cfg: ModelConfig): Promise<string> {
  const sys = '你是连接测试助手，只回复 JSON：{"message":"OK","actions":[]}';
  const content = await callModel(chatCfg(cfg, 'plan'), sys, 'ping');
  return String(content || '').trim().slice(0, 80);
}

// 模型偶尔会在 JSON 里夹零宽字符 / BOM，或在字符串值里直接换行、打 Tab（JSON 不允许裸控制字符）：解析前先清掉 / 转义，不改变内容本身
export function sanitizeJSON(text: string): string {
  const s = String(text || '').replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
  let out = '', inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; } if (ch === '\r') { continue; } if (ch === '\t') { out += '\\t'; continue; }
      if (ch < ' ') continue;
      out += ch; continue;
    }
    if (ch === '"') inStr = true;
    out += ch;
  }
  return out;
}
export function parsePlanJSON(content: string): any {
  const text = sanitizeJSON(String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
  let first: any = null;
  try { return JSON.parse(text); } catch (e) { first = e; }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* fallthrough */ } }
  throw new Error(`模型返回的不是有效 JSON（${String(first?.message || first).slice(0, 80)}）`);
}

// 宽松解析：先按严格方式，不行再修复被截断的 JSON（补上没闭合的引号 / 括号，砍掉末尾不完整的键值）
export function parsePlanJSONLoose(content: string): { data: any; repaired: boolean; truncated: boolean } {
  try { return { data: parsePlanJSON(content), repaired: false, truncated: false }; } catch { /* 试着修 */ }
  const fixed = repairJSONInfo(String(content || ''));
  if (!fixed) throw new Error('模型返回的不是有效 JSON');
  return { data: fixed.data, repaired: true, truncated: fixed.closedString };
}
// 补上没闭合的引号 / 括号；closedString 表示最后是断在一个字符串中间（真截断的标志，结构写歪时不会出现）
function autoClose(s: string): { text: string; closedString: boolean } {
  const stack: string[] = []; let inStr = false, esc = false;
  for (const ch of s) {
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']'); else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = s; if (inStr) out += '"';
  out = out.replace(/[,\s]+$/, '').replace(/,?\s*"[^"]*"\s*:\s*$/, '').replace(/[,\s]+$/, '');   // 去掉末尾的逗号与悬空的 key
  return { text: out + stack.reverse().join(''), closedString: inStr };
}
export function repairJSON(text: string): any | null { return repairJSONInfo(text)?.data ?? null; }
// 同上，另外告诉调用方修复时是否断在字符串中间：是 = 内容真被截断（最后一个操作多半只写了一半），否 = 只是结构写歪或末尾有多余字符
export function repairJSONInfo(text: string): { data: any; closedString: boolean } | null {
  const clean = sanitizeJSON(text); const start = clean.indexOf('{'); if (start < 0) return null;
  let s = clean.slice(start).replace(/\s*```\s*$/, '');
  for (let attempt = 0; attempt < 400 && s.length > 1; attempt++) {   // 回复越长要砍的次数越多，30 次不够（实测长回复砍不到可解析的前缀就放弃了）
    const closed = autoClose(s);
    try { const v = JSON.parse(closed.text); if (v && typeof v === 'object') return { data: v, closedString: closed.closedString }; } catch { /* 再砍一截 */ }
    const cut = Math.max(s.lastIndexOf(','), s.lastIndexOf('{'), s.lastIndexOf('['), s.lastIndexOf('}'), s.lastIndexOf(']'), s.lastIndexOf('"'));
    if (cut <= 0) break; s = s.slice(0, cut);
  }
  return null;
}

// 最后一道防线：整份 JSON 修不回来时，直接扫出 message 和每一个 {"tool":…,"args":{…}} 对象（按括号配平取，不依赖整份文档合法）
// 用户要求：有问题尽量把能用的捞出来继续走，不要一见解析失败就停
export function salvagePlanParts(text: string): { message: string; actions: any[] } {
  const raw = sanitizeJSON(String(text || ''));
  const message = partialPlanMessage(raw);
  const actions: any[] = [];
  const re = /\{\s*"tool"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = m.index; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) break;                       // 最后一个对象没写完，丢掉
    try { const v = JSON.parse(raw.slice(m.index, end + 1)); if (v && typeof v.tool === 'string') actions.push(v); } catch { /* 这一个残缺就跳过 */ }
    re.lastIndex = end;
  }
  return { message, actions };
}

// 从尚未结束的 JSON 文本里取出 "message" 字段已生成的部分（流式显示用）
export function partialPlanMessage(text: string): string {
  const m = String(text || '').match(/"message"\s*:\s*"/); if (!m) return '';
  let i = (m.index || 0) + m[0].length, out = '';
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') { const n = text[i + 1]; if (n === undefined) break; if (n === 'n') out += '\n'; else if (n === 't') out += '\t'; else if (n === 'u') { const hex = text.slice(i + 2, i + 6); if (hex.length < 4) break; out += String.fromCharCode(parseInt(hex, 16)); i += 4; } else out += n; i += 2; continue; }
    if (ch === '"') break;
    out += ch; i++;
  }
  return out;
}
