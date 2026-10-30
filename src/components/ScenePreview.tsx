// ===== 画面方案预览：工作区里打开「画面-NN.json」时，直接把这条片子画出来 =====
// 画面由代码渲染，所以预览和成片是同一套绘制代码——这里看到什么样，渲出来就是什么样。
// 左边是一条可以拖的时间轴（每段一格，点哪段跳哪段），右边是逐段的口播与模板，改完 JSON 立刻能看到。
import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Clapperboard, AlertTriangle } from 'lucide-react';
import type { Doc } from '../lib/types';
import { lintSpec, parseSpec, timelineOf } from '../lib/render/spec';
import { loadImages, previewFrame, renderScene, renderSupported } from '../lib/render/video';
import { useFiles } from '../lib/store';
import { THEMES } from '../lib/render/theme';
import { toast } from './Toast';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function ScenePreview({ doc }: { doc: Doc }) {
  const spec = useMemo(() => parseSpec(doc.content), [doc.content]);
  const tl = useMemo(() => (spec ? timelineOf(spec) : null), [spec]);
  const issues = useMemo(() => (spec ? lintSpec(spec) : ['不是合法的 JSON，改完会自动重新预览']), [spec]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0.8);   // 开在第一段进场动画做完的位置，不然打开是一张空画面
  const [playing, setPlaying] = useState(false);
  const images = useRef<Map<string, ImageBitmap>>(new Map());
  const [imagesAt, setImagesAt] = useState(0);
  const [rendering, setRendering] = useState('');

  // 画面里要用到的图片先解码好，不然第一帧是空的
  useEffect(() => { if (tl && t > tl.total) setT(Math.max(0, tl.total - 0.1)); }, [tl?.total]);
  useEffect(() => { let alive = true; if (!spec) return; loadImages(spec).then(m => { if (alive) { images.current = m; setImagesAt(Date.now()); } }); return () => { alive = false; }; }, [spec?.beats.map(b => b.mediaId).join(',')]);

  useEffect(() => { if (spec && canvasRef.current) previewFrame(spec, canvasRef.current, t, images.current); }, [spec, t, imagesAt]);

  // 播放：按真实时间推进（画的是同一套 drawFrame，所以预览的节奏就是成片的节奏）
  useEffect(() => {
    if (!playing || !tl) return;
    let raf = 0; const started = performance.now() - t * 1000;
    const loop = () => {
      const now = (performance.now() - started) / 1000;
      if (now >= tl.total) { setT(0); setPlaying(false); return; }
      setT(now); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, tl?.total]);

  if (!spec || !tl) return <div className="scene-preview"><p className="scene-bad"><AlertTriangle size={15} /> 这份文稿不是合法的 JSON，切到「编辑」改一下就能预览。</p></div>;
  const current = tl.slots.find(s => t >= s.start && t < s.end) || tl.slots[0];

  return (
    <div className="scene-preview">
      <div className="scene-stage">
        <canvas ref={canvasRef} className={`scene-canvas ${spec.ratio === '9:16' ? 'tall' : spec.ratio === '1:1' ? 'square' : 'wide'}`} />
        <div className="scene-controls">
          <button type="button" className="icon-btn" aria-label={playing ? '暂停' : '播放'} onClick={() => setPlaying(p => !p)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
          <input type="range" min={0} max={Math.max(0.1, tl.total)} step={0.04} value={t} onChange={e => { setPlaying(false); setT(Number(e.target.value)); }} aria-label="时间轴" />
          <span className="scene-time">{fmt(t)} / {fmt(tl.total)}</span>
          <button type="button" className="btn small" disabled={!renderSupported() || !!rendering} title={renderSupported() ? '把这条渲染成 MP4（本地渲染，不计费）' : '当前浏览器不支持 WebCodecs'}
            onClick={async () => {
              setPlaying(false); setRendering('准备…');
              try {
                const item = await renderScene(spec, { name: spec.title, onProgress: text => setRendering(text) });
                toast(`已渲染「${item.name}」（${item.duration} 秒）`, { label: '查看', onClick: () => useFiles.getState().openInPane(item.id) });
              } catch (e: any) { toast('渲染失败：' + (e?.message || e)); }
              finally { setRendering(''); }
            }}>
            <Clapperboard size={14} /> {rendering || '渲染成片'}
          </button>
        </div>
      </div>
      <div className="scene-side">
        <div className="scene-meta">
          <b>{spec.title}</b>
          <span>{spec.ratio} · {THEMES[spec.theme]?.name.split('（')[0] || spec.theme} · {spec.beats.length} 段 · {Math.round(tl.total)} 秒{spec.beats.every(b => !b.voiceId) ? ' · 未配音（时长按字数估）' : ' · 已配音'}</span>
        </div>
        {issues.length > 0 && (
          <ul className="scene-issues">{issues.slice(0, 5).map((x, i) => <li key={i}><AlertTriangle size={13} /> {x}</li>)}</ul>
        )}
        <ol className="scene-beats">
          {tl.slots.map(s => (
            <li key={s.index} className={s === current ? 'on' : ''} onClick={() => { setPlaying(false); setT(s.start + 0.01); }}>
              <span className="beat-no">{String(s.index + 1).padStart(2, '0')}</span>
              <span className="beat-tpl">{s.beat.template}</span>
              <span className="beat-say">{s.beat.say || '（无口播）'}</span>
              <span className="beat-sec">{(s.end - s.start).toFixed(1)}s</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
