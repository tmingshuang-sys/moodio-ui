// ===== 课程转写稿：字幕文件 / 自动字幕 / 纯文本 → 带时间码的转写稿 =====
// 科普流水线的入口。来源有三种：本地助手用 yt-dlp 抓的字幕、用户上传的 .srt/.vtt/.txt、直接粘贴的文本。
// 难点在 YouTube 的自动字幕：它是滚动式的，每条都把上一条的尾巴重复一遍，直接拼起来会得到三倍长的车轱辘话。
export interface Cue { start: number; end: number; text: string; }

const clean = (s: string) => s
  .replace(/<\/?[csv][^>]*>/gi, '')                 // <c>、<v Speaker> 这类内联标签
  .replace(/<\d{2}:\d{2}:\d{2}[.,]\d{3}>/g, '')     // 逐词时间戳
  .replace(/\{\\[^}]*\}/g, '')                      // ASS 样式残留
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

export function parseTimecode(s: string): number {
  const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!m) return NaN;
  const [, h, mm, ss, ms] = m;
  return (Number(h || 0) * 3600) + Number(mm) * 60 + Number(ss) + Number((ms || '0').padEnd(3, '0')) / 1000;
}
export function formatTimecode(sec: number, withHours = false): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h || withHours ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

// WebVTT / SRT：两者结构几乎一样，差别只在「-->」两边的时间写法与序号行
function parseCueBlocks(src: string): Cue[] {
  const out: Cue[] = [];
  for (const block of src.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n').filter(l => l.trim() && !/^WEBVTT/i.test(l) && !/^(Kind|Language|NOTE|STYLE):/i.test(l));
    const at = lines.findIndex(l => l.includes('-->'));
    if (at < 0) continue;
    const [from, to] = lines[at].split('-->').map(x => x.trim().split(/\s+/)[0]);
    const start = parseTimecode(from), end = parseTimecode(to);
    if (!Number.isFinite(start)) continue;
    const text = clean(lines.slice(at + 1).join(' '));
    if (text) out.push({ start, end: Number.isFinite(end) ? end : start + 2, text });
  }
  return out;
}

// YouTube json3：{ events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }] }
function parseJson3(raw: any): Cue[] {
  const events = Array.isArray(raw?.events) ? raw.events : [];
  return events.map((e: any) => {
    const text = clean((Array.isArray(e?.segs) ? e.segs : []).map((s: any) => String(s?.utf8 || '')).join(''));
    const start = Number(e?.tStartMs || 0) / 1000;
    return { start, end: start + Number(e?.dDurationMs || 2000) / 1000, text };
  }).filter((c: Cue) => c.text);
}

// 滚动字幕去重：后一条往往以前一条的整行开头，把重复的前缀切掉只留新增的部分
export function dedupeRolling(cues: Cue[]): Cue[] {
  const out: Cue[] = [];
  for (const cue of cues) {
    const prev = out[out.length - 1];
    if (!prev) { out.push({ ...cue }); continue; }
    let text = cue.text;
    if (text === prev.text) { prev.end = Math.max(prev.end, cue.end); continue; }
    if (text.startsWith(prev.text)) text = text.slice(prev.text.length).trim();        // 整段重复
    else {
      // 找出「上一条的结尾」与「这一条的开头」最长的重叠，按词比对（中文按字）
      const a = prev.text, b = text;
      const max = Math.min(a.length, b.length, 120);
      for (let n = max; n >= 6; n--) { if (a.endsWith(b.slice(0, n))) { text = b.slice(n).trim(); break; } }
    }
    if (!text) { prev.end = Math.max(prev.end, cue.end); continue; }
    out.push({ ...cue, text });
  }
  return out;
}

export function parseCaptions(src: string): Cue[] {
  const text = String(src || '').trim();
  if (!text) return [];
  if (text.startsWith('{')) { try { const cues = parseJson3(JSON.parse(text)); if (cues.length) return dedupeRolling(cues); } catch { /* 不是 json3 就按文本走 */ } }
  // 认出是字幕文件就按字幕解析到底：没有一条 cue 也返回空，不要把 WEBVTT 表头当成正文
  if (text.includes('-->') || /^WEBVTT/i.test(text)) return dedupeRolling(parseCueBlocks(text));
  // 纯文本：没有时间码，按空行或句号切段，时间按阅读速度估（只用于排序，不会当作课程原时间码引用）
  const paras = text.split(/\n{2,}/).map(p => clean(p)).filter(Boolean);
  let t = 0;
  return paras.map(p => { const start = t; t += Math.max(2, p.length / 5); return { start, end: t, text: p }; });
}

// 合并成可读段落：同一段话被切成几十条字幕，拼回成一段，便于模型通读与人工校对
export function mergeCues(cues: Cue[], maxChars = 420, maxGap = 2.5): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const last = out[out.length - 1];
    const joinable = last && c.start - last.end <= maxGap && (last.text.length + c.text.length) <= maxChars && !/[.。!！?？]$/.test(last.text);
    if (joinable) { last.text = (last.text + ' ' + c.text).replace(/\s+/g, ' ').trim(); last.end = c.end; }
    else out.push({ ...c });
  }
  return out;
}

export interface TranscriptMeta { title?: string; url?: string; lang?: string; auto?: boolean; duration?: number; }
// 转写稿.md：每 ~3 分钟一个带时间码的小节，后面的知识点梳理要靠这些时间码回溯原文
export function transcriptMarkdown(cues: Cue[], meta: TranscriptMeta = {}, sectionSeconds = 180): string {
  const merged = mergeCues(cues);
  const total = meta.duration || (merged.length ? merged[merged.length - 1].end : 0);
  const head = [
    `# 转写稿：${meta.title || '未命名课程'}`,
    '',
    `> 来源：${meta.url || '用户提供'}　时长：${formatTimecode(total, true)}　语言：${meta.lang || '未标注'}${meta.auto ? '　（自动字幕，专有名词可能有错）' : ''}`,
    `> 共 ${merged.length} 段。引用原文时写上时间码，知识点清单里的「来源」一列要能对回这里。`,
    '',
  ];
  const body: string[] = [];
  let sectionStart = -1;
  for (const c of merged) {
    if (sectionStart < 0 || c.start - sectionStart >= sectionSeconds) {
      sectionStart = c.start;
      body.push('', `## [${formatTimecode(c.start, true)}]`, '');
    }
    body.push(`[${formatTimecode(c.start)}] ${c.text}`, '');
  }
  return head.concat(body).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// 把转写稿切成模型吃得下的块：按小节边界切，每块控制在 maxChars 以内，块与块之间带一句重叠防止在知识点中间切断
export function chunkTranscript(markdown: string, maxChars = 7000): string[] {
  const text = String(markdown || '');
  const sections = text.split(/\n(?=## \[)/).map(s => s.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const sec of sections) {
    if (sec.length > maxChars) {                      // 单个小节就超长：按段落硬切
      if (cur) { out.push(cur); cur = ''; }
      const paras = sec.split(/\n\n/);
      let part = '';
      for (const p of paras) {
        if ((part + '\n\n' + p).length > maxChars && part) { out.push(part); part = ''; }
        part = part ? part + '\n\n' + p : p;
      }
      if (part) cur = part;
      continue;
    }
    if ((cur + '\n\n' + sec).length > maxChars && cur) { out.push(cur); cur = ''; }
    cur = cur ? cur + '\n\n' + sec : sec;
  }
  if (cur) out.push(cur);
  return out.length ? out : [text.slice(0, maxChars)];
}

// 从 YouTube 链接里取出 videoId（watch / youtu.be / shorts / embed 都认）
export function youtubeId(url: string): string | null {
  const s = String(url || '').trim();
  const m = s.match(/(?:v=|youtu\.be\/|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || s.match(/^([A-Za-z0-9_-]{11})$/);
  return m ? m[1] : null;
}
