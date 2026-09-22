// ===== 模型调用：Claude（Anthropic Messages API，浏览器直连）或 OpenAI 兼容 Chat Completions（默认走 Moodio 网关）=====
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
export function modelLabel(cfg: ModelConfig | null | undefined): string { if (!cfg?.apiKey) return '未连接模型'; const p = modelProvider(cfg); return `${p === 'claude' ? 'Claude' : 'OpenAI 兼容'} · ${cfg.model || PROVIDER_DEFAULTS[p].model}`; }
// 写作模型分工：创意类请求用写作模型（设置里单独指定），其余用默认模型
const CREATIVE_RE = /(写|续写|改写|润色|扩写|重写|台词|对白|一场|整集|一集|脚本|广告|短片|大纲|梗概|节拍|小传|设定|风格|分镜|提示词|prompt)/i;
export function isCreativeRequest(text: string): boolean { const t = String(text || ''); return CREATIVE_RE.test(t) && !/^(删除|重命名|导出|切换|打开|列出|读取|恢复|合并)/.test(t.trim()); }
export function writerCfg(cfg: ModelConfig): ModelConfig { const model = String(cfg.writerModel || '').trim(); if (!model) return cfg; return { ...cfg, model, thinking: cfg.writerThinking || cfg.thinking }; }

export interface CallOptions { signal?: AbortSignal; onText?: (text: string) => void; onReasoning?: (text: string) => void; }

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

export async function callClaude(cfg: ModelConfig, sys: string, t: string, { signal, onText, onReasoning }: CallOptions = {}): Promise<string> {
  const base = (cfg.baseUrl || PROVIDER_DEFAULTS.claude.baseUrl).replace(/\/+$/, '').replace(/\/v1$/, '');
  const model = cfg.model || PROVIDER_DEFAULTS.claude.model, streaming = typeof onText === 'function';
  const body: any = { model, max_tokens: 16000, system: sys, fallbacks: 'default', output_config: { effort: 'medium' }, messages: [{ role: 'user', content: t }] };
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

export async function callOpenAI(cfg: ModelConfig, sys: string, t: string, { signal, onText, onReasoning }: CallOptions = {}): Promise<string> {
  const streaming = typeof onText === 'function';
  const body: any = { model: cfg.model || PROVIDER_DEFAULTS.openai.model, temperature: 0.7, messages: [{ role: 'system', content: sys }, { role: 'user', content: t }], response_format: { type: 'json_object' } };
  const think = String(cfg.thinking || '');
  if (think === 'off') body.thinking = { type: 'disabled' };
  else if (['low', 'high', 'max'].includes(think)) { body.thinking = { type: 'enabled' }; body.reasoning_effort = think; delete body.temperature; }
  if (streaming) body.stream = true;
  const res = await fetch((cfg.baseUrl || PROVIDER_DEFAULTS.openai.baseUrl).replace(/\/+$/, '') + '/chat/completions', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (cfg.apiKey || '') }, body: JSON.stringify(body) });
  if (!res.ok) throw await readModelError(res);
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

export async function callModel(cfg: ModelConfig, sys: string, t: string, opts: CallOptions = {}): Promise<string> {
  try { return modelProvider(cfg) === 'claude' ? await callClaude(cfg, sys, t, opts) : await callOpenAI(cfg, sys, t, opts); }
  catch (e) { throw explainModelError(e); }
}

export function explainModelError(e: any): Error {
  if (e instanceof TypeError || /Failed to fetch|Load failed|NetworkError/i.test(e?.message || '')) return new Error('未能连接模型服务。请检查网络、API 地址和服务的浏览器跨域访问设置，然后重试。');
  if (/访问口令不正确/.test(e?.message || '')) return new Error(e.message + '。Moodio 网关的 API Key 位置填的是网关的访问口令，不是 DeepSeek 的 key。');
  return e instanceof Error ? e : new Error(String(e?.message || e));
}

export async function probeModel(cfg: ModelConfig): Promise<string> {
  const sys = '你是连接测试助手，只回复 JSON：{"message":"OK","actions":[]}';
  const content = modelProvider(cfg) === 'claude' ? await callClaude(cfg, sys, 'ping') : await callOpenAI(cfg, sys, 'ping');
  return String(content || '').trim().slice(0, 80);
}

export function parsePlanJSON(content: string): any {
  const text = String(content || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* fallthrough */ } }
  throw new Error('模型返回的不是有效 JSON');
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
