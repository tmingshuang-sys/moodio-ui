// ===== 输入框下方的「模型」按钮：选图片 / 视频模型与画面比例、时长，选完立即生效并存进 localStorage =====
// 模型目录在 lib/mediamodels.ts（每个模型声明它接受哪些参数），生成时由 lib/mediagen.ts 按声明拼请求。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { ModelPreset, RatioKey } from '../lib/mediamodels';
import { IMAGE_MODELS, VIDEO_MODELS, VIDEO_IMAGE_MODELS, IMAGE_RATIOS, VIDEO_RATIOS, VIDEO_DURATIONS, findPreset } from '../lib/mediamodels';
import { MEDIA_DEFAULTS, currentImageModel, currentVideoModel, currentVideoImageModel, mediaReadyReason } from '../lib/mediagen';
import { modelCfg, saveModelCfg } from '../lib/model';
import type { ModelConfig } from '../lib/types';
import { useT } from '../lib/i18n';

type Tab = 'video' | 'image';

// 画面比例的小图示：按比例画一个圆角矩形
function RatioIcon({ ratio }: { ratio: RatioKey }) {
  const [w, h] = ratio.split(':').map(Number);
  const scale = 18 / Math.max(w, h);
  return <span className="ratio-box" style={{ width: Math.round(w * scale), height: Math.round(h * scale) }} aria-hidden="true" />;
}

function ModelRow({ preset, active, onPick }: { preset: ModelPreset; active: boolean; onPick: () => void }) {
  return (
    <button type="button" className={`mp-model${active ? ' active' : ''}`} onClick={onPick}>
      <span className="mp-check">{active && <Check size={14} strokeWidth={3} />}</span>
      <span className="mp-model-body">
        <span className="mp-model-name">{preset.name}{preset.verified && <em title="本项目实测跑通过">实测</em>}</span>
        <span className="mp-model-hint">{preset.hint}</span>
      </span>
    </button>
  );
}

export default function ModelPrefs() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('video');
  const [cfg, setCfgState] = useState<ModelConfig>(() => modelCfg() || {});
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [tick, setTick] = useState(0);   // 窗口尺寸变化时重新定位（不关闭面板）

  useEffect(() => { const fn = () => setCfgState(modelCfg() || {}); window.addEventListener('moodio:model-changed', fn); return () => window.removeEventListener('moodio:model-changed', fn); }, []);
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !panelRef.current) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect(), w = panelRef.current.offsetWidth;
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), bottom: Math.max(8, window.innerHeight - r.top + 8) });
  }, [open, tab, tick]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setTick(x => x + 1);
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, [open]);

  const patch = (next: Partial<ModelConfig>) => { const merged = { ...(modelCfg() || {}), ...next }; saveModelCfg(merged); setCfgState(merged); };

  const imageId = currentImageModel(cfg), videoId = currentVideoModel(cfg), videoImageId = currentVideoImageModel(cfg);
  const imageRatio = (cfg.imageRatio || MEDIA_DEFAULTS.imageRatio) as RatioKey;
  const videoRatio = (cfg.videoRatio || MEDIA_DEFAULTS.videoRatio) as RatioKey;
  const duration = cfg.videoDuration || MEDIA_DEFAULTS.videoDuration;
  const activeName = tab === 'video' ? (findPreset(VIDEO_MODELS, videoId)?.name || '自定义') : (findPreset(IMAGE_MODELS, imageId)?.name || '自定义');
  const videoPreset = findPreset(VIDEO_MODELS, videoId);
  const imagePreset = findPreset(IMAGE_MODELS, imageId);
  const videoImagePreset = findPreset(VIDEO_IMAGE_MODELS, videoImageId);
  const notReady = mediaReadyReason();

  return (
    <>
      <button ref={btnRef} type="button" className={`tool-btn wide${open ? ' on' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="dialog" title={t('生成模型')}>
        <SlidersHorizontal size={16} /><span>{activeName}</span>
      </button>
      {open && (
        <div ref={panelRef} className="mp-panel" role="dialog" aria-label={t('生成模型')} style={{ left: pos?.left ?? 0, bottom: pos?.bottom ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          <div className="mp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'video'} className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>{t('视频偏好')}</button>
            <button type="button" role="tab" aria-selected={tab === 'image'} className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>{t('图片偏好')}</button>
          </div>
          {notReady && <p className="mp-warn">{notReady}</p>}
          <div className="mp-body">
            <div className="mp-col mp-models">
              <h4>{t('模型选择')}</h4>
              {(tab === 'video' ? VIDEO_MODELS : IMAGE_MODELS).map(m => (
                <ModelRow key={m.id} preset={m} active={m.id === (tab === 'video' ? videoId : imageId)} onPick={() => patch(tab === 'video' ? { videoModel: m.id } : { imageModel: m.id })} />
              ))}
              {tab === 'video' && (
                <>
                  <h4 className="mp-sub">{t('图生视频')}<small>{t('用工作区里的图片当首帧时')}</small></h4>
                  {VIDEO_IMAGE_MODELS.map(m => <ModelRow key={m.id} preset={m} active={m.id === videoImageId} onPick={() => patch({ videoImageModel: m.id })} />)}
                </>
              )}
            </div>
            <div className="mp-col mp-options">
              <h4>{t('画面比例')}</h4>
              {tab === 'video' ? (
                videoPreset?.ratio ? (
                  <div className="mp-chips ratios">
                    {VIDEO_RATIOS.map(r => <button key={r} type="button" className={r === videoRatio ? 'active' : ''} onClick={() => patch({ videoRatio: r })}><RatioIcon ratio={r} /><span>{r}</span></button>)}
                  </div>
                ) : <p className="mp-note">{t('该模型不支持在这里设置，由模型自己决定')}</p>
              ) : (
                imagePreset?.ratio ? (
                  <div className="mp-chips ratios">
                    {IMAGE_RATIOS.map(r => <button key={r} type="button" className={r === imageRatio ? 'active' : ''} onClick={() => patch({ imageRatio: r })}><RatioIcon ratio={r} /><span>{r}</span></button>)}
                  </div>
                ) : <p className="mp-note">{t('该模型不支持在这里设置，由模型自己决定')}</p>
              )}
              {tab === 'video' && (
                <>
                  <h4>{t('时长')}</h4>
                  {videoPreset?.duration || videoImagePreset?.duration ? (
                    <div className="mp-chips">
                      {VIDEO_DURATIONS.map(d => <button key={d} type="button" className={d === duration ? 'active' : ''} onClick={() => patch({ videoDuration: d })}>{d} 秒</button>)}
                    </div>
                  ) : <p className="mp-note">{t('该模型不支持在这里设置，由模型自己决定')}</p>}
                </>
              )}
              <h4>{t('当前模型')}</h4>
              <p className="mp-id">{tab === 'video' ? videoId : imageId}</p>
              {tab === 'video' && <p className="mp-id">{videoImageId}<small>{t('图生视频')}</small></p>}
              <p className="mp-note"><Sparkles size={12} />{t('生成按次计费，Agent 也用这里选的模型')}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
