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

describe('per-model input', () => {
  it('only sends fields the fal model declares', async () => {
    const { __test } = await load();
    const flux = { id: 'x', name: 'x', hint: '', provider: 'fal' as const, ratio: 'image_size' as const };
    expect(__test.buildInput(flux, 'a cat', { ratio: '9:16', duration: '10' })).toEqual({ prompt: 'a cat', image_size: 'portrait_16_9' });
    const kling = { id: 'x', name: 'x', hint: '', provider: 'fal' as const, ratio: 'aspect_ratio' as const, duration: true };
    expect(__test.buildInput(kling, 'a cat', { ratio: '9:16', duration: '10' })).toEqual({ prompt: 'a cat', aspect_ratio: '9:16', duration: '10' });
    const minimal = { id: 'x', name: 'x', hint: '', provider: 'fal' as const };
    expect(__test.buildInput(minimal, 'a cat', { ratio: '9:16', duration: '10' })).toEqual({ prompt: 'a cat' });
  });
  it('appends ark parameters to the prompt instead of sending fields', async () => {
    const { __test } = await load();
    const seedance = { id: 'x', name: 'x', hint: '', provider: 'ark' as const, ratio: 'arg' as const, duration: true, resolution: true };
    expect(__test.arkPromptArgs(seedance, 'a cat', { ratio: '9:16', duration: '10', resolution: '1080p' })).toBe('a cat --ratio 9:16 --duration 10 --resolution 1080p');
    expect(__test.arkPromptArgs(seedance, 'a cat', { duration: '5' })).toBe('a cat --duration 5');   // 图生视频不带画幅
    expect(__test.buildInput(seedance, 'a cat', { ratio: '9:16', duration: '10' })).toEqual({ prompt: 'a cat', duration: '10' });   // arg 不当成字段发出去
  });
});

describe('image resolution and smart duration', () => {
  it('computes ark pixel sizes by ratio and tier, all multiples of 16 and above Seedream 5 minimum', async () => {
    const m = await import('./mediamodels');
    expect(m.arkImageSize('16:9', '2K')).toBe('2736x1536');
    expect(m.arkImageSize('9:16', '2K')).toBe('1536x2736');
    expect(m.arkImageSize('1:1', '4K')).toBe('4096x4096');
    expect(m.arkImageSize('16:9', '4K')).toBe('5456x3072');
    for (const r of m.IMAGE_RATIOS) for (const tier of m.IMAGE_RESOLUTIONS) { const [w, h] = m.arkImageSize(r, tier).split('x').map(Number); expect(w % 16).toBe(0); expect(h % 16).toBe(0); expect(w * h).toBeGreaterThanOrEqual(3686400); }
  });
  it('picks a duration from prompt length and snaps it to what the model allows', async () => {
    const m = await import('./mediamodels');
    expect(m.smartDuration('a red lantern in the rain')).toBe(5);
    expect(m.smartDuration('雨'.repeat(45))).toBe(8);      // 45 个汉字
    expect(m.smartDuration('雨'.repeat(90))).toBe(10);
    expect(m.smartDuration('word '.repeat(200))).toBe(20);   // 200 个英文词
    expect(m.smartDuration('a cat --ratio 16:9 --duration 5')).toBe(5);   // 已拼进去的参数不算长度
    const kling = { id: 'k', name: 'k', hint: '', provider: 'fal' as const, duration: true, durations: [5, 10] };
    expect(m.clampDuration(kling, 8)).toBe(10); expect(m.clampDuration(kling, 6)).toBe(5);
    const seedance = { id: 's', name: 's', hint: '', provider: 'ark' as const, duration: true, durationRange: [2, 30] as [number, number] };
    expect(m.resolveDuration(seedance, 'custom', '45', '')).toBe(30);
    expect(m.resolveDuration(seedance, 'custom', 'x', '')).toBe(5);
    expect(m.resolveDuration(seedance, 'smart', '30', 'short')).toBe(5);   // 智能模式忽略滑杆的值
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
