// ===== 导出到专业剪辑软件：生成 FCPXML，达芬奇 / Final Cut / Premiere 导入后时间线上片段已按顺序排好 =====
// 已用 DaVinci Resolve 19.0.0 的脚本 API 实测通过（三段片段导入后在视频轨上首尾相接）。
// 关键限制：媒体引用必须是**绝对**的 file:// URL，相对路径（./x.mp4、file://x.mp4）和省略 media-rep 都会让达芬奇整份拒绝，
// 所以需要知道片段文件夹的绝对路径；浏览器的 File System Access API 不给路径，只能让用户粘贴一次基准路径记下来。
export interface NleClip { file: string; name: string; seconds: number; width?: number; height?: number; }
export interface NleSubtitle { start: number; end: number; text: string; }
export interface NleOptions { title: string; clips: NleClip[]; dirPath: string; fps?: number; }

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 绝对路径转 file:// URL：每一段单独编码，中文与空格都能过
export function fileUrl(absPath: string): string {
  const parts = String(absPath).replace(/\/+$/, '').split('/');
  return 'file://' + parts.map(p => encodeURIComponent(p)).join('/');
}
// 路径规整：去掉尾部斜杠与首尾空白，用户从访达拷来的路径可能带引号
export function cleanPath(p: string): string {
  return String(p || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
}
export const isAbsolutePath = (p: string) => /^\/[^/]/.test(cleanPath(p));
export const joinPath = (...parts: string[]) => parts.map(p => String(p).replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/').replace(/^/, '/');

// FCPXML 1.9：一个事件、一个项目、一条时间线，片段首尾相接
export function buildFcpxml(opts: NleOptions): string {
  const fps = opts.fps || 30; const base = fps * 100;
  const frames = (sec: number) => Math.max(0, Math.round(sec * fps));
  const at = (sec: number) => `${frames(sec) * 100}/${base}s`;            // 时间点：0 就是 0，不补帧
  const dur = (sec: number) => `${Math.max(1, frames(sec)) * 100}/${base}s`;   // 时长：至少一帧，否则片段是空的
  const first = opts.clips[0];
  const width = first?.width || 1920, height = first?.height || 1080;
  const dir = cleanPath(opts.dirPath);
  const assets = opts.clips.map((c, i) => `    <asset id="a${i + 1}" name="${esc(c.name)}" uid="MOODIO${String(i + 1).padStart(3, '0')}" start="0s" duration="${dur(c.seconds)}" hasVideo="1" hasAudio="1" videoSources="1" audioSources="1" audioChannels="2" audioRate="48000" format="r0">
      <media-rep kind="original-media" src="${esc(fileUrl(dir + '/' + c.file))}"/>
    </asset>`).join('\n');
  let offset = 0;
  const spine = opts.clips.map((c, i) => {
    const line = `        <asset-clip ref="a${i + 1}" offset="${at(offset)}" name="${esc(c.name)}" start="0s" duration="${dur(c.seconds)}" format="r0" tcFormat="NDF"/>`;
    offset += c.seconds; return line;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r0" name="FFVideoFormatRateUndefined" frameDuration="100/${base}s" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
${assets}
  </resources>
  <library>
    <event name="Moodio">
      <project name="${esc(opts.title)}">
        <sequence format="r0" duration="${at(offset)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spine}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

// SRT 字幕：达芬奇的脚本接口没有导入字幕的方法（只有「从音频生成字幕」），所以备一份 SRT 让用户拖进字幕轨；
// 配乐 / 配音也不写进 FCPXML——实测把它们当 connected clip 挂上去，达芬奇会把第二段之后视频自己的音频挤到配乐轨，
// 所以导出目录里单独放音频文件，本地助手那条路则用脚本接口 AddTrack + AppendToTimeline 精确放置
export function buildSrt(subs: NleSubtitle[]): string {
  const tc = (sec: number) => {
    const ms = Math.max(0, Math.round(sec * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  return (subs || []).filter(s => s && s.text && s.end > s.start).sort((a, b) => a.start - b.start)
    .map((s, i) => `${i + 1}\n${tc(s.start)} --> ${tc(s.end)}\n${String(s.text).trim()}\n`).join('\n');
}

// EDL：不含媒体路径的后备格式，导入时由剪辑软件按文件名关联素材
export function buildEdl(opts: Pick<NleOptions, 'title' | 'clips' | 'fps'>): string {
  const fps = opts.fps || 30;
  const tc = (sec: number) => {
    const f = Math.round(sec * fps); const ff = f % fps, s = Math.floor(f / fps) % 60, m = Math.floor(f / fps / 60) % 60, h = Math.floor(f / fps / 3600);
    return [h, m, s, ff].map(n => String(n).padStart(2, '0')).join(':');
  };
  const lines = [`TITLE: ${opts.title}`, 'FCM: NON-DROP FRAME', ''];
  let at = 0;
  opts.clips.forEach((c, i) => {
    lines.push(`${String(i + 1).padStart(3, '0')}  AX       AA/V  C        ${tc(0)} ${tc(c.seconds)} ${tc(at)} ${tc(at + c.seconds)}`);
    lines.push(`* FROM CLIP NAME: ${c.file}`, '');
    at += c.seconds;
  });
  return lines.join('\n');
}

// 文件扩展名：文件名里有就用，否则按 mime 推
const MIME_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export function fileExt(m: { name?: string; mime?: string }): string {
  const fromName = /\.([a-z0-9]{2,4})$/i.exec(m.name || '')?.[1]?.toLowerCase(); if (fromName) return fromName;
  return MIME_EXT[(m.mime || '').toLowerCase()] || 'mp4';
}
// 清单：给用户看的顺序表，也方便对着拖时间线
export function buildManifest(title: string, items: { file: string; name: string; seconds?: number }[]): string {
  const total = items.reduce((s, i) => s + (i.seconds || 0), 0);
  const lines = [`${title} · 片段清单`, '', '按下面的顺序拖到剪映时间线（文件名已经排好序）：', ''];
  items.forEach((it, i) => lines.push(`${String(i + 1).padStart(2, '0')}. ${it.file}${it.seconds ? `  ${it.seconds.toFixed(1)} 秒` : ''}   ← ${it.name}`));
  if (total) lines.push('', `合计 ${items.length} 段，约 ${Math.round(total)} 秒`);
  return lines.join('\n') + '\n';
}

// 拖放里解析出本地绝对路径：访达拖进来的是 file:///... 的 uri-list
export function pathFromDrop(dt: DataTransfer | null): string {
  if (!dt) return '';
  for (const type of ['text/uri-list', 'text/plain']) {
    const raw = dt.getData(type); if (!raw) continue;
    const line = raw.split(/[\r\n]+/).map(t => t.trim()).find(t => t.startsWith('file://') || t.startsWith('/'));
    if (!line) continue;
    try { return line.startsWith('file://') ? decodeURIComponent(new URL(line).pathname).replace(/\/$/, '') : line.replace(/\/$/, ''); } catch { /* 下一种 */ }
  }
  return '';
}
