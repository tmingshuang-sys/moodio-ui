// 图片 / 视频生成里不依赖网络的部分：网关地址推导、队列地址改写、结果地址提取
import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  (globalThis as any).localStorage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) };
  (globalThis as any).document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {}, createElement: () => ({ style: {}, remove() {}, click() {}, setAttribute() {} }) };
  (globalThis as any).window = Object.assign(globalThis, { setTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  (globalThis as any).CustomEvent = class { constructor(public type: string, public init?: any) {} };
  (globalThis as any).location = { reload() {} };
  vi.resetModules();
});
const load = () => import('./mediagen');
const setCfg = (cfg: Record<string, unknown>) => memory.set('moodio-agent-model', JSON.stringify(cfg));

describe('media endpoint', () => {
  it('reuses the chat gateway without its /v1 suffix', async () => {
    setCfg({ provider: 'openai', baseUrl: 'https://gw.example.com/v1', apiKey: 'token-abc' });
    const { mediaEndpoint, mediaReadyReason } = await load();
    expect(mediaEndpoint()).toEqual({ base: 'https://gw.example.com', token: 'token-abc' });
    expect(mediaReadyReason()).toBeNull();
  });
  it('prefers explicitly configured media gateway and token', async () => {
    setCfg({ provider: 'openai', baseUrl: 'https://gw.example.com/v1', apiKey: 'chat', mediaBaseUrl: 'https://media.example.com/', mediaToken: 'media' });
    const { mediaEndpoint } = await load();
    expect(mediaEndpoint()).toEqual({ base: 'https://media.example.com', token: 'media' });
  });
  it('does not borrow the Anthropic base or key for media', async () => {
    setCfg({ provider: 'claude', baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-x' });
    const { mediaEndpoint, MEDIA_DEFAULTS } = await load();
    expect(mediaEndpoint()).toBeNull();   // 口令为空 → 不可用，提示用户去设置里补
    setCfg({ provider: 'claude', baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-x', mediaToken: 'gw-token' });
    expect((await load()).mediaEndpoint()).toEqual({ base: MEDIA_DEFAULTS.baseUrl, token: 'gw-token' });
  });
  it('explains why generation is unavailable', async () => {
    const { mediaReadyReason } = await load();
    expect(mediaReadyReason()).toMatch(/还没有连接模型网关/);
  });
});

describe('queue helpers', () => {
  it('rewrites fal queue urls onto the gateway so the browser never needs the fal key', async () => {
    const { __test } = await load();
    expect(__test.viaGateway('https://queue.fal.run/fal-ai/flux/requests/abc-1/status', 'https://gw.example.com'))
      .toBe('https://gw.example.com/fal/fal-ai/flux/requests/abc-1/status');
    expect(__test.viaGateway('https://queue.fal.run/fal-ai/kling-video/requests/x?logs=1', 'https://gw.example.com'))
      .toBe('https://gw.example.com/fal/fal-ai/kling-video/requests/x?logs=1');
  });
  it('finds the result url across the shapes different models return', async () => {
    const { __test } = await load();
    expect(__test.pickUrl({ images: [{ url: 'https://v3.fal.media/a.jpg', content_type: 'image/jpeg' }] })).toEqual({ url: 'https://v3.fal.media/a.jpg', contentType: 'image/jpeg' });
    expect(__test.pickUrl({ video: { url: 'https://v3.fal.media/b.mp4' } })).toEqual({ url: 'https://v3.fal.media/b.mp4', contentType: undefined });
    expect(__test.pickUrl({ images: ['https://v3.fal.media/c.png'] })).toEqual({ url: 'https://v3.fal.media/c.png' });
    expect(__test.pickUrl({ status: 'COMPLETED' })).toBeNull();
  });
});
