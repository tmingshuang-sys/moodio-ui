// ===== 图片 / 视频模型目录：两家上游（fal.ai 与火山方舟），每个模型声明它接受哪些可选参数 =====
// 不同模型入参不一样：fal 有的收 image_size（landscape_16_9 这种枚举）、有的收 aspect_ratio（"16:9"）、有的只收 prompt；
// 方舟把画幅 / 时长 / 分辨率以 --ratio --duration --resolution 拼在提示词后面。这里显式标出来，只发模型认识的字段。
// 想加模型：方舟用 GET /ark/models 能列出账号下全部型号；fal 的 id 从 fal.ai 上抄，注意队列接口只在顶层命名空间不存在时才返回 404，
// 也就是说「提交返回 200」不能证明具体变体存在，要看任务状态或实际跑一次才算数。
export type Provider = 'fal' | 'ark';
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
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0', hint: '方舟，最新一代，中文与版面最好', provider: 'ark', ratio: 'arg', resolution: true, verified: true },
  { id: 'doubao-seedream-5-0-pro-260628', name: 'Seedream 5.0 Pro', hint: '方舟，质量更高', provider: 'ark', ratio: 'arg', resolution: true },
  { id: 'doubao-seedream-5-0-flash-260915', name: 'Seedream 5.0 Flash', hint: '方舟，快且便宜', provider: 'ark', ratio: 'arg', resolution: true },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5', hint: '方舟，上一代稳定版', provider: 'ark', ratio: 'arg', resolution: true },
  { id: 'fal-ai/qwen-image', name: 'Qwen Image', hint: '通义，画面里的中文字更稳', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/ideogram/v3', name: 'Ideogram V3', hint: '海报、带文字的版面', provider: 'fal', ratio: 'image_size' },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', hint: '设计感、图标与插画', provider: 'fal', ratio: 'image_size' },
];

export const VIDEO_MODELS: ModelPreset[] = [
  { id: 'doubao-seedance-2-5-260628', name: 'Seedance 2.5', hint: '方舟，最新一代，需在方舟控制台开通', provider: 'ark', ratio: 'arg', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', hint: '方舟，全模态', provider: 'ark', ratio: 'arg', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-2-0-fast-260128', name: 'Seedance 2.0 Fast', hint: '方舟，极速推理', provider: 'ark', ratio: 'arg', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-2-0-mini-260615', name: 'Seedance 2.0 Mini', hint: '方舟，体验版，最便宜', provider: 'ark', ratio: 'arg', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro', hint: '方舟，上一代稳定版', provider: 'ark', ratio: 'arg', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'fal-ai/kling-video/v1/standard/text-to-video', name: '可灵 1.0 标准（fal）', hint: '稳定，5 秒约 5 分钟', provider: 'fal', ratio: 'aspect_ratio', duration: true, durations: [5, 10], verified: true },
  { id: 'fal-ai/kling-video/v2/master/text-to-video', name: '可灵 2.0 大师（fal）', hint: '质量好，较贵', provider: 'fal', ratio: 'aspect_ratio', duration: true, durations: [5, 10] },
  { id: 'fal-ai/veo3', name: 'Google Veo 3（fal）', hint: '自带音效，最贵', provider: 'fal', ratio: 'aspect_ratio' },
  { id: 'fal-ai/minimax/video-01', name: 'MiniMax 海螺（fal）', hint: '镜头语言好，参数固定', provider: 'fal' },
];

export const VIDEO_IMAGE_MODELS: ModelPreset[] = [
  { id: 'doubao-seedance-2-5-260628', name: 'Seedance 2.5', hint: '方舟，同一模型带首帧图', provider: 'ark', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-2-0-260128', name: 'Seedance 2.0', hint: '方舟，同一模型带首帧图', provider: 'ark', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'doubao-seedance-1-0-pro-250528', name: 'Seedance 1.0 Pro', hint: '方舟，上一代稳定版', provider: 'ark', duration: true, durationRange: [2, 30], resolution: true },
  { id: 'fal-ai/kling-video/v1/standard/image-to-video', name: '可灵 1.0 标准（fal）', hint: '以首帧图生成', provider: 'fal', duration: true, durations: [5, 10] },
];

// ===== 智能匹配模型：id 为 AUTO 时按候选链依次尝试，遇到「模型不可用」类错误就换下一个 =====
export const AUTO = 'auto';
export type ModelKind = 'image' | 'video' | 'videoImage';
export const AUTO_CHAINS: Record<ModelKind, string[]> = {
  image: ['doubao-seedream-5-0-260128', 'doubao-seedream-5-0-flash-260915', 'doubao-seedream-4-5-251128', 'fal-ai/bytedance/seedream/v3/text-to-image', 'fal-ai/flux/dev'],
  video: ['doubao-seedance-2-5-260628', 'doubao-seedance-2-0-260128', 'doubao-seedance-2-0-fast-260128', 'doubao-seedance-1-0-pro-250528', 'fal-ai/kling-video/v1/standard/text-to-video'],
  videoImage: ['doubao-seedance-2-5-260628', 'doubao-seedance-2-0-260128', 'doubao-seedance-1-0-pro-250528', 'fal-ai/kling-video/v1/standard/image-to-video'],
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

export function findPreset(list: ModelPreset[], id: string | undefined): ModelPreset | null {
  return list.find(m => m.id === String(id || '')) || null;
}
// 自定义 id 的兜底：带斜杠当成 fal，否则当成方舟；图片按 image_size、视频按 aspect_ratio + 时长
export function presetFor(list: ModelPreset[], id: string | undefined, kind: 'image' | 'video' | 'videoImage'): ModelPreset {
  const hit = findPreset(list, id);
  if (hit) return hit;
  const raw = String(id || '');
  const provider: Provider = raw.includes('/') ? 'fal' : 'ark';
  const fallback: ModelPreset = { id: raw, name: '自定义模型', hint: '按通用参数发送', provider };
  if (kind === 'image') { fallback.ratio = provider === 'ark' ? 'arg' : 'image_size'; fallback.resolution = provider === 'ark'; }
  else { fallback.duration = true; fallback.resolution = provider === 'ark'; if (provider === 'ark') fallback.durationRange = [2, 30]; if (kind === 'video') fallback.ratio = provider === 'ark' ? 'arg' : 'aspect_ratio'; }
  return fallback;
}
