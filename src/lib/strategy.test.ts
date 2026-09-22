// 生成策略：按视频模型能力决定长片段优先还是分镜接续，以及规划用的单段秒数
import { describe, expect, it } from 'vitest';
import { VIDEO_MODELS, VIDEO_IMAGE_MODELS, findPreset } from './mediamodels';
import { makeProfile, planClipSeconds, strategyText, strategyLabel, clipLimit } from './strategy';

const v = (id: string) => findPreset(VIDEO_MODELS, id)!;
const vi = (id: string) => findPreset(VIDEO_IMAGE_MODELS, id)!;

describe('generation strategy', () => {
  it('prefers long clips on Seedance 2.x', () => {
    const long = makeProfile(v('doubao-seedance-2-5-260628'), vi('doubao-seedance-2-5-260628'));
    expect(long).toMatchObject({ longTake: true, maxClip: 30, minClip: 2, keyframes: 'both' });
    expect(planClipSeconds({ clipSeconds: 15 }, long)).toBe(20); expect(planClipSeconds({ clipSeconds: 10 }, long)).toBe(20);
    expect(strategyLabel(long)).toBe('长片段优先');
    expect(strategyText(long)).toContain('长镜头'); expect(strategyText(long)).toContain('15–30 秒'); expect(strategyText(long)).toContain('承接');
    expect(strategyText(long, 'mv')).toContain('不做末帧接续'); expect(strategyText(long)).not.toContain('MV：');
  });
  it('falls back to shot-by-shot chaining with keyframes elsewhere', () => {
    const kling = makeProfile(v('fal-ai/kling-video/v1/standard/text-to-video'), vi('fal-ai/kling-video/v1/standard/image-to-video'));
    expect(kling).toMatchObject({ longTake: false, maxClip: 10, minClip: 5, keyframes: 'first' });
    expect(planClipSeconds({ clipSeconds: 15 }, kling)).toBe(10); expect(strategyLabel(kling)).toBe('分镜接续');
    expect(strategyText(kling)).toContain('from_video_id'); expect(strategyText(kling)).toContain('5 / 10 秒'); expect(strategyText(kling)).not.toContain('to_media_id');
    expect(strategyText(kling, 'mv')).not.toContain('首尾帧接续：'); expect(strategyText(kling, 'mv')).toContain('定妆照'); expect(strategyText(kling, 'mv')).toContain('不用 from_video_id');
    const pro = makeProfile(v('doubao-seedance-1-0-pro-250528'), vi('doubao-seedance-1-0-pro-250528'));
    expect(pro).toMatchObject({ longTake: false, maxClip: 10, keyframes: 'both' }); expect(strategyText(pro)).toContain('to_media_id');
    const veo = makeProfile(v('fal-ai/veo3'), vi('fal-ai/kling-video/v1/standard/image-to-video'));
    expect(veo).toMatchObject({ longTake: false, maxClip: 8 }); expect(planClipSeconds({ clipSeconds: 15 }, veo)).toBe(8);
    expect(clipLimit({ id: 'x', name: 'x', hint: '', provider: 'fal' })).toBe(10);
    expect(clipLimit({ id: 'x', name: 'x', hint: '', provider: 'ark', durationRange: [2, 12] })).toBe(12);
  });
});
