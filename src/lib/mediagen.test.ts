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

describe('smart model matching', () => {
  it('defaults every model slot to auto and expands auto to the fallback chain', async () => {
    const m = await import('./mediamodels');
    const { MEDIA_DEFAULTS, currentImageModel, currentVideoModel, effectivePreset, modelDisplayName } = await load();
    expect(MEDIA_DEFAULTS.imageModel).toBe(m.AUTO); expect(MEDIA_DEFAULTS.videoModel).toBe(m.AUTO); expect(MEDIA_DEFAULTS.videoImageModel).toBe(m.AUTO);
    expect(currentImageModel(null)).toBe('auto'); expect(currentVideoModel({})).toBe('auto');
    expect(m.modelChain('image', 'auto')[0]).toBe('seedream-5-0-260128');      // 图片默认 Seedream 5.0
    expect(m.modelChain('video', undefined)[0]).toBe('dreamina-seedance-2-5-260628');   // 视频默认 Seedance 2.5
    expect(m.modelChain('video', 'fal-ai/veo3')).toEqual(['fal-ai/veo3']);            // 选了具体模型就只用它
    for (const kind of ['image', 'video', 'videoImage'] as const) {
      const list = kind === 'image' ? m.IMAGE_MODELS : kind === 'video' ? m.VIDEO_MODELS : m.VIDEO_IMAGE_MODELS;
      for (const id of m.AUTO_CHAINS[kind]) expect(m.findPreset(list, id), `${kind} chain has unknown model ${id}`).not.toBeNull();
      if (kind !== 'videoImage') expect(m.findPreset(list, m.AUTO_CHAINS[kind].at(-1)!)!.verified, `${kind} chain must end with a verified model`).toBe(true);   // 图生视频的可灵还没实测过
    }
    expect(effectivePreset('image', 'auto').id).toBe('seedream-5-0-260128');
    expect(effectivePreset('image', 'auto').resolution).toBe(true);     // 面板按链首模型显示 2K / 4K
    expect(modelDisplayName('video', 'auto')).toBe('智能匹配');
    expect(modelDisplayName('video', 'dreamina-seedance-2-5-260628')).toBe('Seedance 2.5（BytePlus）');
  });
  it('only treats "model unavailable" errors as a reason to fall back', async () => {
    const m = await import('./mediamodels');
    expect(m.unavailableReason(Object.assign(new Error('x'), { code: 'ModelNotOpen' }))).toBe('未开通');
    expect(m.unavailableReason(Object.assign(new Error('x'), { code: 'AccountOverdueError' }))).toBe('余额不足');
    expect(m.unavailableReason(Object.assign(new Error('x'), { code: 'HTTP_404' }))).toBe('不存在');
    expect(m.unavailableReason(Object.assign(new Error('x'), { code: 'HTTP_503' }))).toBe('网关未配置');
    expect(m.unavailableReason(Object.assign(new Error('x'), { code: 'HTTP_422' }))).toBeNull();   // 参数错误不换模型
    expect(m.unavailableReason(new Error('generation failed'))).toBeNull();
    expect(m.unavailableReason(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBeNull();
  });
  it('walks the chain, records what it skipped, and stops at the first model that works', async () => {
    const m = await import('./mediamodels');
    const tried: string[] = [];
    const r = await m.runWithFallback(['a', 'b', 'c', 'd'], async id => {
      tried.push(id);
      if (id === 'a') throw Object.assign(new Error('closed'), { code: 'ModelNotOpen' });
      if (id === 'b') throw Object.assign(new Error('overdue'), { code: 'AccountOverdueError' });
      return 'made-by-' + id;
    });
    expect(r).toEqual({ result: 'made-by-c', model: 'c', skipped: [{ model: 'a', reason: '未开通' }, { model: 'b', reason: '余额不足' }] });
    expect(tried).toEqual(['a', 'b', 'c']);
    // 生成本身失败：原样抛出，不再往下试
    await expect(m.runWithFallback(['a', 'b'], async id => { if (id === 'a') throw new Error('bad prompt'); return id; })).rejects.toThrow('bad prompt');
    // 链上全部不可用：抛出最后一个模型的错误，用户能看到真实原因
    await expect(m.runWithFallback(['a', 'b'], async () => { throw Object.assign(new Error('closed'), { code: 'ModelNotOpen' }); })).rejects.toThrow('closed');
  });
  it('migrates a saved explicit model choice to auto exactly once', async () => {
    setCfg({ provider: 'openai', baseUrl: 'https://gw.example.com/v1', apiKey: 'token-abc', imageModel: 'fal-ai/flux/dev', videoModel: 'fal-ai/veo3' });
    const { currentImageModel, currentVideoModel } = await load();
    expect(currentImageModel()).toBe('auto'); expect(currentVideoModel()).toBe('auto');
    expect(JSON.parse(memory.get('moodio-agent-model')!).apiKey).toBe('token-abc');   // 其他设置原样保留
    vi.resetModules();
    setCfg({ ...JSON.parse(memory.get('moodio-agent-model')!), videoModel: 'fal-ai/veo3' });   // 用户之后又手动选了模型
    expect((await load()).currentVideoModel()).toBe('fal-ai/veo3');                   // 第二次启动不再改回去
  });
});

describe('speech input', () => {
  it('sends only the fields MiniMax speech accepts, asks for a url and boosts Chinese', async () => {
    const { buildSpeechInput, DEFAULT_VOICE_ID } = await load();
    const zh = buildSpeechInput({ text: '老周开末班公交二十年。', voiceId: 'v-laozhou', speed: 3, emotion: 'sad' });
    expect(zh).toMatchObject({ prompt: '老周开末班公交二十年。', output_format: 'url', language_boost: 'Chinese', voice_setting: { voice_id: 'v-laozhou', speed: 2, emotion: 'sad' } });
    expect(Object.keys(zh).sort()).toEqual(['audio_setting', 'language_boost', 'output_format', 'prompt', 'voice_setting']);
    const en = buildSpeechInput({ text: 'Hello there', emotion: 'nope' });
    expect(en).toMatchObject({ language_boost: 'auto', voice_setting: { voice_id: DEFAULT_VOICE_ID, speed: 1 } });
    expect((en.voice_setting as any).emotion).toBeUndefined();
  });
  it('lists the voice chain and names the design model', async () => {
    const { currentVoiceModel, modelDisplayName, MEDIA_DEFAULTS } = await load();
    const mm = await import('./mediamodels');
    expect(currentVoiceModel()).toBe(MEDIA_DEFAULTS.voiceModel);
    expect(mm.AUTO_CHAINS.voice[0]).toBe(mm.VOICE_MODELS[0].id);
    expect(modelDisplayName('voice', mm.VOICE_DESIGN_MODEL)).toBe('MiniMax 声音设计');
    expect(modelDisplayName('voice', 'fal-ai/minimax/speech-2.8-hd')).toBe('MiniMax Speech 2.8 HD');
    const custom = mm.presetFor(mm.VOICE_MODELS, 'fal-ai/minimax/speech-9', 'voice');
    expect(custom.provider).toBe('fal'); expect(custom.duration).toBeUndefined(); expect(custom.ratio).toBeUndefined();   // 声音模型不带画幅 / 时长参数
  });
});

describe('video profile', () => {
  it('follows the effective model: auto → Seedance 2.5, the last model that actually ran when auto fell back, or the manual pick', async () => {
    let m = await load();
    expect(m.videoProfile()).toMatchObject({ longTake: true, maxClip: 30, keyframes: 'both' }); expect(m.videoProfile().model.name).toBe('Seedance 2.5（BytePlus）'); expect(m.videoProfile().model.provider).toBe('byteplus');
    memory.set('moodio-last-video-model', 'seedance-1-0-pro-250528'); vi.resetModules(); m = await load();
    expect(m.effectiveVideoId()).toBe('seedance-1-0-pro-250528'); expect(m.videoProfile()).toMatchObject({ longTake: false, maxClip: 12 });
    memory.set('moodio-last-video-model', 'not-in-chain'); vi.resetModules(); m = await load();
    expect(m.effectiveVideoId()).toBe('dreamina-seedance-2-5-260628');
    const mm = await import('./mediamodels'); expect(mm.isArkLike('byteplus')).toBe(true); expect(mm.isArkLike('fal')).toBe(false);
    expect(mm.presetFor(mm.VIDEO_MODELS, 'dreamina-seedance-2-0-260128', 'video')).toMatchObject({ provider: 'byteplus', durationRange: [4, 15], maxClip: 15 });
    expect(mm.presetByName('Seedance 2.5（BytePlus）')?.nativeAudio).toBe(true); expect(mm.presetByName('可灵 1.0 标准（fal）')?.nativeAudio).toBeFalsy(); expect(mm.presetByName('本地合成')).toBeNull();
    memory.set('moodio-model-prefs-v2', '1'); setCfg({ videoModel: 'fal-ai/kling-video/v1/standard/text-to-video' }); vi.resetModules(); m = await load();
    expect(m.videoProfile()).toMatchObject({ longTake: false, maxClip: 10 }); expect(m.videoProfile().model.name).toBe('可灵 1.0 标准（fal）');
  });
  it('builds Ark content with first and last frame roles', async () => {
    const { __test } = await load();
    expect(__test.arkVideoContent('t', 'data:a', 'data:b')).toEqual([{ type: 'text', text: 't' }, { type: 'image_url', image_url: { url: 'data:a' }, role: 'first_frame' }, { type: 'image_url', image_url: { url: 'data:b' }, role: 'last_frame' }]);
    expect(__test.arkVideoContent('t')).toEqual([{ type: 'text', text: 't' }]);
  });
});

