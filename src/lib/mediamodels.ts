// ===== 图片 / 视频模型目录：id 经 fal 队列接口探测确认存在（未知 id 返回 404），每个模型声明它接受哪些可选参数 =====
// 不同模型的入参不一样：有的收 image_size（landscape_16_9 这种枚举），有的收 aspect_ratio（"16:9"），有的只收 prompt。
// 这里显式标出来，发请求时只发模型认识的字段，避免被 422 退回。想加模型就往下面数组里加一条。
export type RatioKey = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
export type RatioParam = 'image_size' | 'aspect_ratio';

export interface ModelPreset {
  id: string;
  name: string;
  hint: string;
  ratio?: RatioParam;     // 不填 = 这个模型不在这里设画面比例
  duration?: boolean;     // 是否发送时长
  verified?: boolean;     // 本仓库实际跑通过
}

export const IMAGE_RATIOS: RatioKey[] = ['16:9', '9:16', '1:1', '4:3', '3:4'];
export const VIDEO_RATIOS: RatioKey[] = ['16:9', '9:16', '1:1'];
export const VIDEO_DURATIONS = ['5', '10'];

// 画面比例 → 各模型要的写法
const IMAGE_SIZE_VALUE: Record<RatioKey, string> = { '16:9': 'landscape_16_9', '9:16': 'portrait_16_9', '1:1': 'square_hd', '4:3': 'landscape_4_3', '3:4': 'portrait_4_3' };
export function ratioValue(param: RatioParam, ratio: RatioKey): string { return param === 'image_size' ? IMAGE_SIZE_VALUE[ratio] : ratio; }

export const IMAGE_MODELS: ModelPreset[] = [
  { id: 'fal-ai/flux/dev', name: 'FLUX.1 dev', hint: '通用，画质与速度均衡', ratio: 'image_size', verified: true },
  { id: 'fal-ai/flux/schnell', name: 'FLUX.1 schnell', hint: '最快，适合大量出草图', ratio: 'image_size' },
  { id: 'fal-ai/flux-pro/v1.1', name: 'FLUX1.1 pro', hint: '质感更好，成本更高', ratio: 'image_size' },
  { id: 'fal-ai/flux-pro/v1.1-ultra', name: 'FLUX1.1 pro ultra', hint: '更高分辨率', ratio: 'aspect_ratio' },
  { id: 'fal-ai/bytedance/seedream/v3/text-to-image', name: 'Seedream 3.0', hint: '字节，中文理解好', ratio: 'image_size' },
  { id: 'fal-ai/qwen-image', name: 'Qwen Image', hint: '通义，画面里的中文字更稳', ratio: 'image_size' },
  { id: 'fal-ai/ideogram/v3', name: 'Ideogram V3', hint: '海报、带文字的版面', ratio: 'image_size' },
  { id: 'fal-ai/recraft-v3', name: 'Recraft V3', hint: '设计感、图标与插画', ratio: 'image_size' },
];

export const VIDEO_MODELS: ModelPreset[] = [
  { id: 'fal-ai/kling-video/v1/standard/text-to-video', name: '可灵 1.0 标准', hint: '稳定，5 秒约 5 分钟', ratio: 'aspect_ratio', duration: true, verified: true },
  { id: 'fal-ai/kling-video/v1.6/standard/text-to-video', name: '可灵 1.6 标准', hint: '动态与一致性更好', ratio: 'aspect_ratio', duration: true },
  { id: 'fal-ai/kling-video/v2/master/text-to-video', name: '可灵 2.0 大师', hint: '质量最好，最贵', ratio: 'aspect_ratio', duration: true },
  { id: 'fal-ai/bytedance/seedance/v1/lite/text-to-video', name: 'Seedance 1.0 Lite', hint: '字节，快且便宜', ratio: 'aspect_ratio', duration: true },
  { id: 'fal-ai/minimax/video-01', name: 'MiniMax 海螺', hint: '镜头语言好，参数固定', },
  { id: 'fal-ai/veo3', name: 'Google Veo 3', hint: '自带音效，最贵', ratio: 'aspect_ratio' },
  { id: 'fal-ai/hunyuan-video', name: '混元视频', hint: '开源模型，参数固定' },
  { id: 'fal-ai/wan-t2v', name: 'Wan 2.1', hint: '开源模型，参数固定' },
  { id: 'fal-ai/luma-dream-machine', name: 'Luma Dream Machine', hint: '运动自然', ratio: 'aspect_ratio' },
];

export const VIDEO_IMAGE_MODELS: ModelPreset[] = [
  { id: 'fal-ai/kling-video/v1/standard/image-to-video', name: '可灵 1.0 标准', hint: '以首帧图生成', duration: true },
  { id: 'fal-ai/kling-video/v1.6/standard/image-to-video', name: '可灵 1.6 标准', hint: '一致性更好', duration: true },
  { id: 'fal-ai/bytedance/seedance/v1/lite/image-to-video', name: 'Seedance 1.0 Lite', hint: '快且便宜', duration: true },
];

export function findPreset(list: ModelPreset[], id: string | undefined): ModelPreset | null {
  return list.find(m => m.id === String(id || '')) || null;
}
// 自定义 id 的兜底：图片按 image_size、视频按 aspect_ratio + 时长，与多数模型一致
export function presetFor(list: ModelPreset[], id: string | undefined, kind: 'image' | 'video' | 'videoImage'): ModelPreset {
  const hit = findPreset(list, id);
  if (hit) return hit;
  const fallback: ModelPreset = { id: String(id || ''), name: '自定义模型', hint: '按通用参数发送' };
  if (kind === 'image') fallback.ratio = 'image_size';
  else if (kind === 'video') { fallback.ratio = 'aspect_ratio'; fallback.duration = true; }
  else fallback.duration = true;
  return fallback;
}
