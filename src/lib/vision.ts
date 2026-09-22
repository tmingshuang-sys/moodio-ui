// ===== 看图：把媒体库里的图片缩到 1024 边后转成 data URL，交给支持图片输入的模型（Kimi K3 / Claude 等）=====
// 用途：参考图自动质检（生成后立刻检查主体、畸形、构图、风格），以及 Agent 的 inspect_image 工具按需看图。
import type { ImageCheck } from './types';
import { modelCfg, visionCfg, callModel, parsePlanJSON } from './model';
import { getBlob } from './storage';

export function visionReady(): boolean { return !!visionCfg(modelCfg()); }
export const VISION_MISSING = '当前模型不支持看图。在模型设置的「视觉模型」里填一个支持图片输入的模型（例如 kimi-k3）后再试。';

export async function imageDataUrl(id: string, maxSide = 1024): Promise<string> {
  const blob = await getBlob(id); if (!blob) throw new Error('图片不在本机媒体库里');
  const bmp = await createImageBitmap(blob);
  const r = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * r)); c.height = Math.max(1, Math.round(bmp.height * r));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  return c.toDataURL('image/jpeg', 0.85);
}

export async function askAboutImages(ids: string[], question: string, sys = '你是严谨的视觉审片助手，只根据画面回答，只输出 JSON。', signal?: AbortSignal): Promise<any> {
  const cfg = visionCfg(modelCfg()); if (!cfg) throw new Error(VISION_MISSING);
  const images: string[] = []; for (const id of ids) images.push(await imageDataUrl(id));
  return parsePlanJSON(await callModel(cfg, sys, question, { images, signal }));
}

// 参考图质检：逐张对照生成要求，判断能不能当后续片段的参考
export async function reviewImages(targets: { id: string; name: string; expect: string }[], signal?: AbortSignal, gate?: string): Promise<ImageCheck[]> {
  const out: ImageCheck[] = [];
  for (const t of targets) {
    if (signal?.aborted) break;
    try {
      const r = await askAboutImages([t.id], `这张图是按下面的要求生成的参考图：「${t.expect.slice(0, 600) || '（无说明）'}」。请判断它能否作为后续视频生成的参考图：主体是否符合要求，是否有明显畸形（多手指、肢体错位、文字乱码、结构错误），构图是否干净、风格是否统一。${gate ? `验收门禁（逐条核对，任一条不过就判「需重生成」，并把不过的那条写进 issues）：${gate.slice(0, 400)}` : ''}只输出 JSON：{"verdict":"通过|需重生成","description":"一句话描述画面","issues":["具体问题（没有就空数组）"]}`, undefined, signal);
      out.push({ id: t.id, name: t.name, verdict: r?.verdict === '需重生成' ? '需重生成' : '通过', description: String(r?.description || '').slice(0, 160), issues: (Array.isArray(r?.issues) ? r.issues : []).map((x: any) => String(x).slice(0, 80)).filter(Boolean).slice(0, 4) });
    } catch (e: any) { out.push({ id: t.id, name: t.name, verdict: '通过', description: `（质检没有完成：${e?.message || e}。请自己看一眼这张图，不对就让 Agent 重新生成）`, issues: [] }); }
  }
  return out;
}
