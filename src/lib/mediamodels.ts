// ===== 图片 / 视频模型目录：两家上游（fal.ai 与 BytePlus 方舟），每个模型声明它接受哪些可选参数 =====
// 不同模型入参不一样：fal 有的收 image_size（landscape_16_9 这种枚举）、有的收 aspect_ratio（"16:9"）、有的只收 prompt；
// 方舟把画幅 / 时长 / 分辨率以 --ratio --duration --resolution 拼在提示词后面。这里显式标出来，只发模型认识的字段。
// 想加模型：方舟用 GET /ark/models 能列出账号下全部型号；fal 的 id 从 fal.ai 上抄，注意队列接口只在顶层命名空间不存在时才返回 404，
// 也就是说「提交返回 200」不能证明具体变体存在，要看任务状态或实际跑一次才算数。
export type Provider = 'fal' | 'ark' | 'byteplus';   // byteplus = BytePlus ModelArk，海外版方舟，接口同构（网关 /byteplus/*）
export const isArkLike = (p: string | undefined) => p === 'ark' || p === 'byteplus';
export type RatioKey = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type RatioParam = 'image_size' | 'aspect_ratio' | 'arg';   // arg = 方舟，拼进提示词

export interface ModelPreset {
  id: string;
  name: string;
  hint: string;
  provider: Provider;
  ratio?: RatioParam;              // 不填 = 这个模型不在这里设画面比例
  duration?: boolean;              // 是否可设时长
  durations?: number[];            // 只接受这几档（fal 的可灵只有 5 / 10）；不填则按 durationRange
  durationRange?: [number, number];// 自定义时长的范围（方舟）
  resolution?: boolean;            // 是否可设分辨率（方舟视频 480p/720p/1080p，方舟图片 2K/4K）
  verified?: boolean;              // 本仓库实际跑通过
  audioRef?: boolean;              // 能把音色样本当参考音频传给模型（mediagen 目前只传图片参考，接通后再在预设上打开）
  maxClip?: number;                // 规划片段时的单段上限（秒）；不填按 durations / durationRange 推（strategy.ts 的 clipLimit）
  longTake?: boolean;              // 长视频能力：单段 15 秒以上且一致性好（Seedance 2.x），片段方案以长片段优先
  keyframes?: 'first' | 'both';    // 图生视频收首帧图 / 首尾帧图（方舟 Seedance 首尾帧都收，fal 可灵只收首帧）
  nativeAudio?: boolean;           // 模型自己生成对白 / 旁白 / 音效（Seedance 2.x、Veo 3）：成片阶段不再合成配音，否则台词会叠两遍
}

export const IMAGE_RATIOS: RatioKey[] = ['16:9', '9:16', '1:1', '4:3', '3:4'];
export const VIDEO_RATIOS: RatioKey[] = ['16:9', '9:16', '1:1'];
export const VIDEO_RESOLUTIONS = ['480p', '720p', '1080p'];
export const IMAGE_RESOLUTIONS = ['2K', '4K'];
export const DURATION_MIN = 1, DURATION_MAX = 30;   // 自定义时长滑杆范围（秒），各模型自己还有上限

// 画面比例 → 各家要的写法
const IMAGE_SIZE_VALUE: Record<RatioKey, string> = { '16:9': 'landscape_16_9', '9:16': 'portrait_16_9', '1:1': 'square_hd', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3' };
export function ratioValue(param: RatioParam, ratio: RatioKey): string { return param === 'image_size' ? IMAGE_SIZE_VALUE[ratio] : ratio; }
// 方舟文生图按像素给尺寸：2K ≈ 2048² 像素、4K ≈ 4096² 像素，按画幅分配宽高并取 16 的倍数（Seedream 5 要求不少于 3686400 像素，2K 档已满足）
const PIXEL_BUDGET: Record<string, number> = { '2K': 2048 * 2048, '4K': 4096 * 4096 };
export function arkImageSize(ratio: RatioKey, tier = '2K'): string {
  const [rw, rh] = ratio.split(':').map(Number); const px = PIXEL_BUDGET[tier] || PIXEL_BUDGET['2K'];
  const r16 = (n: number) => Math.max(16, Math.round(n / 16) * 16);
  return `${r16(Math.sqrt(px * rw / rh))}x${r16(Math.sqrt(px * rh / rw))}`;
}

// 智能时长：按提示词长度估一个秒数（中文按字、英文按词），再收敛到模型允许的档位或范围
export function smartDuration(prompt: string): number {
  const text = String(prompt || '').replace(/--\S+\s+\S+/g, '').trim();
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = text.replace(/[\u3400-\u9fff]/g, ' ').split(/\s+/).filter(Boolean).length;
  const units = cjk + words;
  if (units <= 30) return 5; if (units <= 60) return 8; if (units <= 100) return 10; if (units <= 160) return 15; return 20;
}
export function clampDuration(preset: ModelPreset, seconds: number): number {
  if (preset.durations?.length) return preset.durations.reduce((best, d) => Math.abs(d - seconds) < Math.abs(best - seconds) ? d : best, preset.durations[0]);
  const [lo, hi] = preset.durationRange || [DURATION_MIN, DURATION_MAX];
  return Math.min(hi, Math.max(lo, Math.round(seconds)));
}
export function resolveDuration(preset: ModelPreset, mode: 'smart' | 'custom', custom: number | string | undefined, prompt: string): number {
  const wanted = mode === 'custom' ? Number(custom) || 5 : smartDuration(prompt);
  return clampDuration(preset, wanted);
}

export const IMAGE_MODELS: ModelPreset[] = [
  { id: 'fal-ai/flux/dev', name: 'FLUX.1 dev', hint: '通用，画质与速度均衡', provider: 'fal', ratio: 'image_size', verified: true },
  { id: 'fal-ai/flux/schnell', name: 'FLUX.1 schnell', hint: '最快，适合大量出草图', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX1.1 pro', hint: '质感更好，成本更高', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/bytedance/seedream/v3/text-to-image', name: 'Seedream 3.0（fal）', hint: '字节，中文理解好', provider: 'fal', ratio: 'image_size', verified: true },
  { id: 'seedream-5-0-260128', name: 'Seedream 5.0（BytePlus）', hint: 'BytePlus 海外版方舟，中文与版面最好', provider: 'byteplus', ratio: 'arg', resolution: true, verified: true },
  { id: 'dola-seedream-5-0-pro-260628', name: 'Seedream 5.0 Pro（BytePlus）', hint: 'BytePlus，质量更高', provider: 'byteplus', ratio: 'arg', resolution: true },
  { id: 'fal-ai/qwen-image', name: 'Qwen Image', hint: '通义，画面里的中文字更稳', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/ideogram/v3', name: 'Ideogram V3', hint: '海报、带文字的版面', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', hint: '设计感、图标与插画', provider: 'fal', ratio: 'image_size' },
];

export const VIDEO_MODELS: ModelPreset[] = [
  { id: 'dreamina-seedance-2-5-260628', name: 'Seedance 2.5（BytePlus）', hint: 'BytePlus 海外版方舟，全模态，单段 4–30 秒，自带人声', provider: 'byteplus', ratio: 'arg', duration: true, durationRange: [4, 30], resolution: true, longTake: true, maxClip: 30, nativeAudio: true, verified: true },
  { id: 'dreamina-seedance-2-0-260128', name: 'Seedance 2.0（BytePlus）', hint: 'BytePlus，单段 4–15 秒，自带人声', provider: 'byteplus', ratio: 'arg', duration: true, durationRange: [4, 15], resolution: true, longTake: true, maxClip: 15, nativeAudio: true },
  { id: 'dreamina-seedance-2-0-fast-260128', name: 'Seedance 2.0 Fast（BytePlus）', hint: 'BytePlus，极速推理，单段 4–15 秒，自带人声', provider: 'byteplus', ratio: 'arg', duration: true, durationRange: [4, 15], resolution: true, longTake: true, maxClip: 15, nativeAudio: true },
  { id: 'seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro（BytePlus）', hint: 'BytePlus，上一代稳定版，单段 2–12 秒', provider: 'byteplus', ratio: 'arg', duration: true, durationRange: [2, 12], maxClip: 12, resolution: true },
  { id: 'fal-ai/kling-video/v1/standard/text-to-video', name: '可灵 1.0 标准（fal）', hint: '稳定，5 秒约 5 分钟', provider: 'fal', ratio: 'aspect_ratio', duration: true, durations: [5, 10], maxClip: 10, verified: true },
  { id: 'fal-ai/kling-video/v2/master/text-to-video', name: '可灵 2.0 大师（fal）', hint: '质量好，较贵', provider: 'fal', ratio: 'aspect_ratio', duration: true, durations: [5, 10], maxClip: 10 },
  { id: 'fal-ai/veo3', name: 'Google Veo 3（fal）', hint: '自带音效与人声，最贵', provider: 'fal', ratio: 'aspect_ratio', maxClip: 8, nativeAudio: true },
  { id: 'fal-ai/minimax/video-01', name: 'MiniMax 海螺（fal）', hint: '镜头语言好，参数固定', provider: 'fal', maxClip: 6 },
];

export const VIDEO_IMAGE_MODELS: ModelPreset[] = [
  { id: 'dreamina-seedance-2-5-260628', name: 'Seedance 2.5（BytePlus）', hint: 'BytePlus，同一模型带首尾帧图', provider: 'byteplus', duration: true, durationRange: [4, 30], resolution: true, longTake: true, maxClip: 30, keyframes: 'both', nativeAudio: true },
  { id: 'dreamina-seedance-2-0-260128', name: 'Seedance 2.0（BytePlus）', hint: 'BytePlus，同一模型带首尾帧图', provider: 'byteplus', duration: true, durationRange: [4, 15], resolution: true, longTake: true, maxClip: 15, keyframes: 'both', nativeAudio: true },
  { id: 'seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro（BytePlus）', hint: 'BytePlus，上一代稳定版，单段 2–12 秒', provider: 'byteplus', duration: true, durationRange: [2, 12], maxClip: 12, resolution: true, keyframes: 'both' },
  { id: 'fal-ai/kling-video/v1/standard/image-to-video', name: '可灵 1.0 标准（fal）', hint: '以首帧图生成', provider: 'fal', duration: true, durations: [5, 10], maxClip: 10, keyframes: 'first' },
];

// 火山方舟（provider 'ark'）已按用户要求整家从目录里去掉：视频型号本来就用不了（2.5 / 2.0 Mini 未开通，其余欠费），图片的 Seedream 5.0 / 4.5 也一并撤掉，
// 同款模型在 BytePlus 上有。'ark' 这个 provider 的代码还留着（BytePlus 与它接口同构，isArkLike 共用），要回来只需往目录里加回型号并配 ARK_API_KEY。
// 声音模型（fal 上托管的 MiniMax）：设计音色固定走 voice-design（按文字描述出一段试听并返回 voice id），合成配音在下面几档里选；
// voice id 只在 MiniMax 系里通用，所以这里不混入别家的 TTS。fal 队列、轮询、代下载与图片 / 视频共用一套。
export const VOICE_DESIGN_MODEL = 'fal-ai/minimax/voice-design';
export const VOICE_DESIGN_PRESET: ModelPreset = { id: VOICE_DESIGN_MODEL, name: 'MiniMax 声音设计', hint: '按文字描述设计音色，返回试听与 voice id', provider: 'fal' };
export const VOICE_MODELS: ModelPreset[] = [
  { id: 'fal-ai/minimax/speech-2.8-hd', name: 'MiniMax Speech 2.8 HD', hint: '最新一代，中文自然，支持停顿与语气标记', provider: 'fal' },
  { id: 'fal-ai/minimax/speech-2.6-hd', name: 'MiniMax Speech 2.6 HD', hint: '上一代稳定版', provider: 'fal' },
  { id: 'fal-ai/minimax/speech-2.6-turbo', name: 'MiniMax Speech 2.6 Turbo', hint: '更快更便宜', provider: 'fal' },
  { id: 'fal-ai/minimax/speech-02-hd', name: 'MiniMax Speech 02 HD', hint: '老版本，兜底', provider: 'fal' },
];

// ===== 智能匹配模型：id 为 AUTO 时按候选链依次尝试，遇到「模型不可用」类错误就换下一个 =====
export const AUTO = 'auto';
export type ModelKind = 'image' | 'video' | 'videoImage' | 'voice';
export const AUTO_CHAINS: Record<ModelKind, string[]> = {
  image: ['seedream-5-0-260128', 'dola-seedream-5-0-pro-260628', 'fal-ai/bytedance/seedream/v3/text-to-image', 'fal-ai/flux/dev'],
  video: ['dreamina-seedance-2-5-260628', 'dreamina-seedance-2-0-260128', 'dreamina-seedance-2-0-fast-260128', 'seedance-1-0-pro-250528', 'fal-ai/kling-video/v1/standard/text-to-video'],
  videoImage: ['dreamina-seedance-2-5-260628', 'dreamina-seedance-2-0-260128', 'seedance-1-0-pro-250528', 'fal-ai/kling-video/v1/standard/image-to-video'],
  voice: ['fal-ai/minimax/speech-2.8-hd', 'fal-ai/minimax/speech-2.6-hd', 'fal-ai/minimax/speech-02-hd'],
};
export const AUTO_LABEL = '智能匹配模型';
export function isAuto(id: string | undefined): boolean { return !id || id === AUTO; }
export function modelChain(kind: ModelKind, id: string | undefined): string[] { return isAuto(id) ? AUTO_CHAINS[kind] : [String(id)]; }
// 只有「这个模型现在用不了」才换下一个：未开通、欠费、不存在、网关没配 key、无权限。生成本身失败或参数错误不换，免得悄悄换成别的模型出结果
const UNAVAILABLE_REASON: Record<string, string> = { ModelNotOpen: '未开通', AccountOverdueError: '余额不足', 'InvalidEndpointOrModel.NotFound': '不存在', HTTP_404: '不存在', HTTP_503: '网关未配置', HTTP_401: '无权限', HTTP_403: '无权限' };
export function unavailableReason(e: unknown): string | null { const code = String((e as any)?.code || ''); return UNAVAILABLE_REASON[code] || null; }

// 依次尝试候选模型；返回实际用到的模型与跳过的记录。fn 抛出不可用错误就换下一个，其他错误原样抛出
export async function runWithFallback<T>(chain: string[], fn: (id: string, index: number) => Promise<T>, onSkip?: (id: string, reason: string) => void): Promise<{ result: T; model: string; skipped: { model: string; reason: string }[] }> {
  const skipped: { model: string; reason: string }[] = [];
  for (let i = 0; i < chain.length; i++) {
    try { return { result: await fn(chain[i], i), model: chain[i], skipped }; }
    catch (e) {
      const reason = unavailableReason(e);
      if (!reason || i === chain.length - 1) throw e;
      skipped.push({ model: chain[i], reason }); onSkip?.(chain[i], reason);
    }
  }
  throw new Error('没有可用的模型');
}

// 按显示名反查预设（媒体项只记了模型名）：成片时据此判断片段是否自带人声
export function presetByName(name: string | undefined): ModelPreset | null {
  const n = String(name || '').trim(); if (!n) return null;
  return [...VIDEO_MODELS, ...VIDEO_IMAGE_MODELS].find(m => m.name === n) || null;
}
export function findPreset(list: ModelPreset[], id: string | undefined): ModelPreset | null {
  return list.find(m => m.id === String(id || '')) || null;
}
// 自定义 id 的兜底：带斜杠当成 fal，否则当成方舟系——火山方舟已从目录去掉，所以默认落到 BytePlus（两家接口同构，差别只在网关前缀）；
// 图片按 image_size、视频按 aspect_ratio + 时长
export function presetFor(list: ModelPreset[], id: string | undefined, kind: ModelKind): ModelPreset {
  const hit = findPreset(list, id);
  if (hit) return hit;
  const raw = String(id || '');
  const provider: Provider = raw.includes('/') ? 'fal' : 'byteplus';
  const fallback: ModelPreset = { id: raw, name: '自定义模型', hint: '按通用参数发送', provider };
  if (kind === 'image') { fallback.ratio = isArkLike(provider) ? 'arg' : 'image_size'; fallback.resolution = isArkLike(provider); }
  else if (kind !== 'voice') { fallback.duration = true; fallback.resolution = isArkLike(provider); if (isArkLike(provider)) fallback.durationRange = [2, 30]; if (kind === 'video') fallback.ratio = isArkLike(provider) ? 'arg' : 'aspect_ratio'; }
  return fallback;
}
