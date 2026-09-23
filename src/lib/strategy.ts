// ===== 生成策略：按当前视频模型的能力决定片段怎么切、镜头怎么排。用户只选模型，这些都藏在背后，具体方案由模型在策略框架内决定 =====
// 长片段优先（Seedance 2.x 这类能一次生成 15 秒以上、一致性好的模型）：片段少而长、多用长镜头，靠模型自身保持人物与光线连贯；
// 分镜接续（可灵、Seedance 1.0 这类单段 5–10 秒的模型）：按镜头拆段，用上一段末帧当下一段首帧（截帧 → 图生视频），收首尾帧的模型还能给尾帧图。
import type { ModelPreset } from './mediamodels';

export interface VideoProfile {
  model: ModelPreset;        // 文生视频用的模型（智能匹配时是实际会落到的那一个）
  imageModel: ModelPreset;   // 图生视频用的模型（首帧 / 尾帧走它）
  longTake: boolean;         // 长片段优先
  maxClip: number;           // 规划时的单段上限（秒）
  minClip: number;           // 单段下限（秒）
  keyframes: 'none' | 'first' | 'both';   // 图生视频能收首帧图 / 首尾帧图
  nativeAudio: boolean;      // 模型自己出对白 / 旁白 / 音效：成片不再合成配音
}
export const LONG_TARGET = 20;   // 长片段优先时的默认单段秒数：够长以少切段，又不到模型上限，留出质量余量

export function clipLimit(p: ModelPreset): number {
  if (p.maxClip) return p.maxClip;
  if (p.durations?.length) return Math.max(...p.durations);
  if (p.durationRange) return p.durationRange[1];
  return 10;
}
export function clipFloor(p: ModelPreset): number {
  if (p.durations?.length) return Math.min(...p.durations);
  if (p.durationRange) return p.durationRange[0];
  return Math.min(5, clipLimit(p));
}
export function makeProfile(model: ModelPreset, imageModel: ModelPreset): VideoProfile {
  const maxClip = clipLimit(model);
  return { model, imageModel, longTake: !!model.longTake && maxClip >= 15, maxClip, minClip: clipFloor(model), keyframes: imageModel.keyframes || 'none', nativeAudio: !!model.nativeAudio };
}
// 规划用的单段秒数：长片段优先取 20 秒左右（不超过上限），否则取类型默认值与上限的较小者
export function planClipSeconds(skill: { clipSeconds: number }, p: VideoProfile): number {
  return p.longTake ? Math.min(p.maxClip, Math.max(skill.clipSeconds, LONG_TARGET)) : Math.max(1, Math.min(skill.clipSeconds, p.maxClip));
}
export function strategyLabel(p: VideoProfile): string { return p.longTake ? '长片段优先' : '分镜接续'; }

// 注入系统提示的策略说明：分镜、片段方案、生成三个阶段都带
export function strategyText(p: VideoProfile, skillId?: string): string {
  const m = p.model; const where = m.provider === 'byteplus' ? 'BytePlus' : m.provider === 'ark' ? '方舟' : 'fal'; const mv = skillId === 'mv';
  const audioNote = p.nativeAudio
    ? '\n声音：当前视频模型自己生成对白、旁白与环境音——片段提示词声音行里的 {对白} / {旁白：…} 会被模型直接说出来；成片阶段只加字幕与配乐，不再合成配音（否则台词会叠两遍）。'
    : '\n声音：当前视频模型无声——对白只进成片字幕，旁白用 generate_speech 合成后在成片里按时间轴放置。';
  const mvNote = (mv ? '\n⑤ MV：片段按歌曲分析的段落表切、不跨段落边界（长片段时可以把相邻两段合成一段，但不超过上限）；段与段在边界硬切、不做末帧接续（不用 from_video_id），每段全量绑定定妆照 @图片1；有人声的段落至少一个正面咬字镜头。' : '') + audioNote;
  if (p.longTake) {
    const hi = Math.min(p.maxClip, 30);
    return `【生成策略 · 长片段优先】当前视频模型 ${m.name}（${where}）单段最长 ${p.maxClip} 秒，图生视频${p.keyframes === 'both' ? '收首帧图与尾帧图' : p.keyframes === 'first' ? '收首帧图' : '不收参考帧'}。规划原则：
① 片段尽量少而长：按场景与连续动作切段，单段 15–${hi} 秒（默认约 ${LONG_TARGET} 秒，最后一段可短），同一场景的连续动作放进同一段生成，靠模型自身保持人物、光线与空间一致；段数可少不可多。
② 剧情允许时多用长镜头：一镜到底、跟拍、缓慢推拉、场面调度，少切碎；一段里要换机位就在画面内容里写「镜头切换」，仍在同一段生成。
③ 段界按段落衔接规范设计：能落在换场景 / 跳时间处就硬切；必须在同一场景里断开时按「接续」写——上一段「结尾状态」与下一段「衔接」句逐字相同，动作从那一瞬间跨段界接着做，不要停顿或定格。
④ 分镜表阶段就按这个原则排镜头时长与运镜，不要按 3–5 秒的碎镜头拆；片段文稿的「时长」就是 generate_video 的 duration。${mvNote}`;
  }
  const fixed = m.durations?.length ? `，只能选 ${m.durations.join(' / ')} 秒` : '';
  const chain = p.keyframes === 'none'
    ? '图生视频不收参考帧，段与段只能靠逐字相同的冻结描述、风格表和承接镜头衔接'
    : `生成第 N+1 段时用 generate_video 的 from_video_id 取上一段末帧当首帧（工具自动截帧存成关键帧图），或先用图片模型出本段首帧关键帧（人物带参考图与冻结描述）再图生视频${p.keyframes === 'both' ? '；模型收尾帧图，可以同时给 to_media_id，让两段在关键帧处无缝相接' : ''}`;
  return `【生成策略 · 分镜接续】当前视频模型 ${m.name}（${where}）单段最长 ${p.maxClip} 秒${fixed}，图生视频${p.keyframes === 'both' ? '收首帧图与尾帧图' : p.keyframes === 'first' ? '收首帧图' : '不收参考帧'}。规划原则：
① 按镜头拆段：单段 ${p.minClip}–${p.maxClip} 秒，一段一个动作或一个机位，不在一段里换场景。
② 一致性靠${mv ? '定妆照与逐字相同的冻结描述，段与段在乐段边界硬切' : `首尾帧接续：${chain}；每段只生成一段，等上一段完成再接下一段`}。
③ 镜头以固定机位与简单运镜为主，动作幅度小；长镜头只在单段上限内安排。
④ 分镜表阶段镜头时长按 ${p.minClip}–${p.maxClip} 秒排；段界按段落衔接规范：from_video_id 只保证第一帧长得像，下一段提示词的「衔接」句仍要逐字照抄上一段「结尾状态」，否则模型从第二帧起就会走样；能硬切的段界优先硬切。片段文稿的「时长」就是 generate_video 的 duration。${mvNote}`;
}
