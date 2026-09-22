// ===== 输入框下方的「模型」按钮：选图片 / 视频模型与画面比例、时长，选完立即生效并存进 localStorage =====
// 模型目录在 lib/mediamodels.ts（每个模型声明它接受哪些参数），生成时由 lib/mediagen.ts 按声明拼请求。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import type { ModelPreset, RatioKey } from '../lib/mediamodels';
import { IMAGE_MODELS, VIDEO_MODELS, VIDEO_IMAGE_MODELS, IMAGE_RATIOS, VIDEO_RATIOS, VIDEO_RESOLUTIONS, IMAGE_RESOLUTIONS, DURATION_MIN, DURATION_MAX, AUTO, AUTO_CHAINS, AUTO_LABEL, isAuto, findPreset } from '../lib/mediamodels';
import { MEDIA_DEFAULTS, currentImageModel, currentVideoModel, currentVideoImageModel, mediaReadyReason, genMode as readGenMode, effectivePreset, modelDisplayName } from '../lib/mediagen';
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

// 列表顶部的「智能匹配模型」：默认从候选链第一个开始，不可用时自动换
function AutoRow({ kind, active, onPick }: { kind: 'image' | 'video' | 'videoImage'; active: boolean; onPick: () => void }) {
  const list = kind === 'image' ? IMAGE_MODELS : kind === 'video' ? VIDEO_MODELS : VIDEO_IMAGE_MODELS;
  const first = findPreset(list, AUTO_CHAINS[kind][0])?.name || AUTO_CHAINS[kind][0];
  return (
    <button type="button" className={`mp-model${active ? ' active' : ''}`} onClick={onPick}>
      <span className="mp-check">{active && <Check size={14} strokeWidth={3} />}</span>
      <span className="mp-model-body">
        <span className="mp-model-name">{AUTO_LABEL}</span>
        <span className="mp-model-hint">默认 {first}，无法生成时自动换成可用的模型</span>
      </span>
    </button>
  );
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
  const duration = Number(cfg.videoDuration || MEDIA_DEFAULTS.videoDuration) || 5;
  const durationMode = cfg.durationMode === 'custom' ? 'custom' : 'smart';
  const resolution = cfg.videoResolution || MEDIA_DEFAULTS.videoResolution;
  const imageResolution = cfg.imageResolution || MEDIA_DEFAULTS.imageResolution;
  const mode = readGenMode(cfg);
  const videoName = modelDisplayName('video', videoId);
  const imageName = modelDisplayName('image', imageId);
  const videoPreset = effectivePreset('video', videoId);
  const imagePreset = effectivePreset('image', imageId);
  const videoImagePreset = effectivePreset('videoImage', videoImageId);
  const notReady = mediaReadyReason();

  return (
    <>
      <button ref={btnRef} type="button" className={`tool-btn${open ? ' on' : ''}`} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={t('生成模型')} title={`${t('视频模型')} ${videoName} · ${t('图片模型')} ${imageName}`}>
        <SlidersHorizontal size={17} />
      </button>
      {open && (
        <div ref={panelRef} className="mp-panel" role="dialog" aria-label={t('生成模型')} style={{ left: pos?.left ?? 0, bottom: pos?.bottom ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          <div className="mp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'video'} className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>{t('视频模型')}</button>
            <button type="button" role="tab" aria-selected={tab === 'image'} className={tab === 'image' ? 'active' : ''} onClick={() => setTab('image')}>{t('图片模型')}</button>
          </div>
          {notReady && <p className="mp-warn">{notReady}</p>}
          <div className="mp-body">
            <div className="mp-col mp-models">
              <h4>{t('模型选择')}</h4>
              <AutoRow kind={tab} active={isAuto(tab === 'video' ? videoId : imageId)} onPick={() => patch(tab === 'video' ? { videoModel: AUTO } : { imageModel: AUTO })} />
              {(tab === 'video' ? VIDEO_MODELS : IMAGE_MODELS).map(m => (
                <ModelRow key={m.id} preset={m} active={m.id === (tab === 'video' ? videoId : imageId)} onPick={() => patch(tab === 'video' ? { videoModel: m.id } : { imageModel: m.id })} />
              ))}
              {tab === 'video' && (
                <>
                  <h4 className="mp-sub">{t('图生视频')}<small>{t('用工作区里的图片当首帧时')}</small></h4>
                  <AutoRow kind="videoImage" active={isAuto(videoImageId)} onPick={() => patch({ videoImageModel: AUTO })} />
                  {VIDEO_IMAGE_MODELS.map(m => <ModelRow key={m.id} preset={m} active={m.id === videoImageId} onPick={() => patch({ videoImageModel: m.id })} />)}
                </>
              )}
            </div>
            <div className="mp-col mp-options">
              {/* 只显示当前模型支持的项，不支持的整段不出现，不放解释文字 */}
              {tab === 'video' && videoPreset?.ratio && (
                <>
                  <h4>{t('画面比例')}</h4>
                  <div className="mp-chips ratios">
                    {VIDEO_RATIOS.map(r => <button key={r} type="button" className={r === videoRatio ? 'active' : ''} onClick={() => patch({ videoRatio: r })}><RatioIcon ratio={r} /><span>{r}</span></button>)}
                  </div>
                </>
              )}
              {tab === 'image' && imagePreset?.ratio && (
                <>
                  <h4>{t('画面比例')}</h4>
                  <div className="mp-chips ratios">
                    {IMAGE_RATIOS.map(r => <button key={r} type="button" className={r === imageRatio ? 'active' : ''} onClick={() => patch({ imageRatio: r })}><RatioIcon ratio={r} /><span>{r}</span></button>)}
                  </div>
                </>
              )}
              {tab === 'image' && imagePreset?.resolution && (
                <>
                  <h4>{t('图片分辨率')}</h4>
                  <div className="mp-chips">
                    {IMAGE_RESOLUTIONS.map(r => <button key={r} type="button" className={r === imageResolution ? 'active' : ''} onClick={() => patch({ imageResolution: r })}>{r}</button>)}
                  </div>
                </>
              )}
              {tab === 'video' && (videoPreset?.resolution || videoImagePreset?.resolution) && (
                <>
                  <h4>{t('视频分辨率')}</h4>
                  <div className="mp-chips">
                    {VIDEO_RESOLUTIONS.map(r => <button key={r} type="button" className={r === resolution ? 'active' : ''} onClick={() => patch({ videoResolution: r })}>{r.toUpperCase()}</button>)}
                  </div>
                </>
              )}
              {tab === 'video' && (videoPreset?.duration || videoImagePreset?.duration) && (
                <>
                  <h4>{t('时长')}</h4>
                  <div className="seg small" role="tablist">
                    <button type="button" className={durationMode === 'smart' ? 'active' : ''} onClick={() => patch({ durationMode: 'smart' })}>{t('智能时长')}</button>
                    <button type="button" className={durationMode === 'custom' ? 'active' : ''} onClick={() => patch({ durationMode: 'custom' })}>{t('自定义时长')}</button>
                  </div>
                  {durationMode === 'custom' && (videoPreset?.durations?.length ? (
                    <div className="mp-chips">
                      {videoPreset.durations.map(d => <button key={d} type="button" className={d === duration ? 'active' : ''} onClick={() => patch({ videoDuration: String(d) })}>{d} {t('秒')}</button>)}
                    </div>
                  ) : (
                    <label className="mp-slider">
                      <input type="range" min={videoPreset?.durationRange?.[0] ?? DURATION_MIN} max={videoPreset?.durationRange?.[1] ?? DURATION_MAX} step={1} value={duration} onChange={e => patch({ videoDuration: e.target.value })} aria-label={t('自定义时长')} />
                      <b>{duration} {t('秒')}</b>
                    </label>
                  ))}
                </>
              )}
              <h4>{t('生成模式')}</h4>
              <div className="seg small" role="tablist">
                <button type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => patch({ genMode: 'manual' })}>{t('手动模式')}</button>
                <button type="button" className={mode === 'auto' ? 'active' : ''} onClick={() => patch({ genMode: 'auto' })}>{t('自动模式')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
