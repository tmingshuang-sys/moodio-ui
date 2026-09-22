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
