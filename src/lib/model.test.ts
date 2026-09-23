// 模型调用层里不依赖网络的部分：图片输入的消息格式、视觉模型的选择
import { describe, expect, it } from 'vitest';
import { openAIUserContent, visionCfg } from './model';

describe('vision support', () => {
  it('sends images as OpenAI-compatible content parts only when present', () => {
    expect(openAIUserContent('hi')).toBe('hi');
    expect(openAIUserContent('看图', ['data:image/jpeg;base64,AAAA'])).toEqual([{ type: 'text', text: '看图' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }]);
  });
  it('picks the vision model from settings, else a main model that can see, else nothing', () => {
    expect(visionCfg(null)).toBeNull();
    expect(visionCfg({ apiKey: 'x', model: 'deepseek-flash' })).toBeNull();                                   // DeepSeek 不能看图
    expect(visionCfg({ apiKey: 'x', model: 'kimi-k3', thinking: 'high' })).toEqual({ apiKey: 'x', model: 'kimi-k3', thinking: '' });
    expect(visionCfg({ apiKey: 'x', model: 'deepseek-flash', visionModel: 'kimi-k3' })!.model).toBe('kimi-k3');   // 主模型不能看图时用设置里的视觉模型
    expect(visionCfg({ apiKey: 'x', provider: 'claude', model: 'claude-opus-5' })!.model).toBe('claude-opus-5');
  });
});

describe('chat model smart matching', () => {
  it('resolves auto to a per-purpose candidate chain and respects explicit choices', async () => {
    const m = await import('./model');
    expect(m.isAutoModel({ apiKey: 'x' })).toBe(true); expect(m.isAutoModel({ apiKey: 'x', model: 'auto' })).toBe(true); expect(m.isAutoModel({ apiKey: 'x', model: 'kimi-k3' })).toBe(false);
    const plan = m.chatCfg({ apiKey: 'x', model: 'auto', thinking: 'low' }, 'plan');
    expect(plan.model).toBe('deepseek-flash'); expect(plan.candidates).toEqual(m.CHAT_AUTO.plan); expect(plan.thinking).toBe('low');
    const write = m.chatCfg({ apiKey: 'x', model: 'auto', writerThinking: 'high' }, 'write');
    expect(write.model).toBe('deepseek-v4-pro'); expect(write.thinking).toBe('high');
    expect(m.chatCfg({ apiKey: 'x', model: 'auto', writerModel: 'kimi-k3' }, 'write').model).toBe('kimi-k3');   // 设置里明确指定的写作模型优先
    expect(m.chatCfg({ apiKey: 'x', model: 'kimi-k3' }, 'plan')).toEqual({ apiKey: 'x', model: 'kimi-k3', temperature: 0.3 });      // 手选模型不带候选链
    expect(m.chatCfg({ apiKey: 'x', model: 'auto' }, 'vision').model).toBe('kimi-k3');                            // 智能匹配走网关时用 Kimi 看图
    expect(m.chatCfg({ apiKey: 'x', model: 'auto', baseUrl: 'https://api.deepseek.com/v1' }, 'vision').candidates).toBeUndefined();   // 直连 DeepSeek 没有能看图的
    expect(m.chatModelName('auto')).toBe('智能匹配'); expect(m.chatModelName('kimi-k3')).toBe('Kimi K3');
    // 温度按用途：规划 0.3、编译 0.4、写作 0.7，手选模型也照此
    expect(plan.temperature).toBe(0.3); expect(write.temperature).toBe(0.7);
    expect(m.chatCfg({ apiKey: 'x', model: 'auto' }, 'compile')).toMatchObject({ model: 'deepseek-v4-pro', temperature: 0.4 });
    expect(m.chatCfg({ apiKey: 'x', model: 'kimi-k3' }, 'plan').temperature).toBe(0.3);
  });
  it('falls through the candidate chain only on model-unavailable errors', async () => {
    const m = await import('./model');
    const calls: string[] = [];
    const reply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    (globalThis as any).fetch = async (_url: string, init: any) => {
      const model = JSON.parse(init.body).model; calls.push(model);
      if (model === 'deepseek-flash') return new Response(JSON.stringify({ error: { message: '网关还没有配置 DEEPSEEK_API_KEY' } }), { status: 503 });
      if (model === 'kimi-k3') return reply('{"message":"from kimi"}');
      return reply('{}');
    };
    const cfg = m.chatCfg({ apiKey: 'x', model: 'auto', baseUrl: 'https://moodio-gateway.moodio-ui.workers.dev/v1' }, 'plan');
    expect(await m.callModel(cfg, 'sys', 'hi')).toBe('{"message":"from kimi"}');
    expect(calls).toEqual(['deepseek-flash', 'kimi-k3']);
    // 生成本身的错误不换模型
    calls.length = 0;
    (globalThis as any).fetch = async (_url: string, init: any) => { calls.push(JSON.parse(init.body).model); return new Response(JSON.stringify({ error: { message: 'content too long' } }), { status: 400 }); };
    await expect(m.callModel(cfg, 'sys', 'hi')).rejects.toThrow('400');
    expect(calls).toEqual(['deepseek-flash']);
  });
});

describe('plan json repair', () => {
  it('closes truncated objects and drops dangling keys', async () => {
    const { repairJSON, parsePlanJSONLoose } = await import('./model');
    expect(repairJSON('{"message":"你好","actions":[{"tool":"open_doc","args":{"id":"d1"}},{"tool":"write_doc","args":{"name":"a.md","content":"半截')).toEqual({ message: '你好', actions: [{ tool: 'open_doc', args: { id: 'd1' } }, { tool: 'write_doc', args: { name: 'a.md', content: '半截' } }] });
    expect(repairJSON('```json\n{"message":"x","actions":[],"followUps":[{"label":"a",')).toEqual({ message: 'x', actions: [], followUps: [{ label: 'a' }] });
    expect(repairJSON('not json at all')).toBeNull();
    expect(parsePlanJSONLoose('{"message":"ok","actions":[]}')).toEqual({ data: { message: 'ok', actions: [] }, repaired: false, truncated: false });
    expect(parsePlanJSONLoose('{"message":"ok","actions":[').repaired).toBe(true);
    // truncated 只在断在字符串中间时为真：结构写歪（这里多了一个 ]）不算截断，最后一个操作要留着
    expect(parsePlanJSONLoose('{"message":"x","actions":[{"tool":"open_doc","args":{"id":"d1"}}]}]}').truncated).toBe(false);
    expect(parsePlanJSONLoose('{"message":"x","actions":[{"tool":"write_doc","args":{"name":"a.md","content":"半截').truncated).toBe(true);
  });
});

describe('plan json sanitising', () => {
  it('strips zero-width characters and escapes raw newlines and tabs inside strings', async () => {
    const { parsePlanJSON, sanitizeJSON } = await import('./model');
    expect(parsePlanJSON('{\u200b"message":"第一行\n第二行\t缩进","actions":[]}\ufeff')).toEqual({ message: '第一行\n第二行\t缩进', actions: [] });
    expect(sanitizeJSON('{"a":"x\\"y\n"}')).toBe('{"a":"x\\"y\\n"}');   // 已转义的引号不动，裸换行转成 \\n
    expect(() => parsePlanJSON('{"message":')).toThrow(/不是有效 JSON（/);
  });
});

describe('temperature rejection', () => {
  it('recognises the Kimi error so the call is retried without temperature', async () => {
    const { rejectsTemperature } = await import('./model');
    expect(rejectsTemperature('invalid temperature: only 1 is allowed for this model')).toBe(true);
    expect(rejectsTemperature('rate limit exceeded')).toBe(false);
  });
});

