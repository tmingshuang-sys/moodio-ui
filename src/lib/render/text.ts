// ===== 文字排版：中英混排折行与自动缩字号 =====
// 纯函数：测宽函数从外面传进来（渲染时传 ctx.measureText，单测时传近似测宽），所以这个文件不碰 canvas。
export type Measure = (text: string, size: number) => number;

// 近似测宽：中日韩全角按 1 个字宽，拉丁与数字按 0.52，标点 0.4。没有 canvas 时（单测、估算）够用了
export const roughMeasure: Measure = (text, size) => {
  let w = 0;
  for (const ch of String(text)) {
    if (/[㐀-鿿぀-ヿ＀-￯]/.test(ch)) w += 1;
    else if (/[,.!?;:'"·]/.test(ch)) w += 0.4;
    else if (/\s/.test(ch)) w += 0.33;
    else w += 0.52;
  }
  return w * size;
};

// 避头尾：这些标点不能出现在行首，宁可让上一行稍微挤一点
const NO_LINE_START = '，。、；：！？）」』》】,.!?;:)]}…%';
const canBreakBefore = (ch: string) => !NO_LINE_START.includes(ch);
const LATIN = /[A-Za-z0-9'’@#%.+\-/]/;

// 把文本切成排版原子：一个拉丁单词是一个原子，一个汉字 / 一个标点 / 一个空格各是一个原子
function atomize(src: string): string[] {
  const out: string[] = []; let word = '';
  for (const ch of src) {
    if (LATIN.test(ch)) { word += ch; continue; }
    if (word) { out.push(word); word = ''; }
    out.push(ch);
  }
  if (word) out.push(word);
  return out;
}

export function wrapText(text: string, size: number, maxWidth: number, measure: Measure, maxLines = 99): string[] {
  const src = String(text || '').replace(/\s+/g, ' ').trim();
  if (!src || maxWidth <= 0) return [];
  const lines: string[] = []; let line = '';
  const push = () => { const s = line.trim(); if (s) lines.push(s); line = ''; };
  for (const a of atomize(src)) {
    if (a === ' ') { if (line) line += a; continue; }
    if (measure(line + a, size) > maxWidth && line && canBreakBefore(a[0])) {
      push(); if (lines.length >= maxLines) return lines.slice(0, maxLines);
    }
    if (!line && a.length > 1 && measure(a, size) > maxWidth) {       // 超长英文单词：硬断
      let rest = a;
      while (measure(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && measure(rest.slice(0, cut), size) > maxWidth) cut--;
        lines.push(rest.slice(0, cut)); rest = rest.slice(cut);
        if (lines.length >= maxLines) return lines.slice(0, maxLines);
      }
      line = rest; continue;
    }
    line += a;
  }
  push();
  return lines.slice(0, maxLines);
}

// 自动字号：在 [min, max] 里找最大的、能把文字排进 maxWidth × maxLines 的字号
export function fitSize(text: string, maxWidth: number, maxLines: number, measure: Measure, max: number, min = 20): { size: number; lines: string[] } {
  for (let size = Math.round(max); size >= min; size -= 2) {
    const lines = wrapText(text, size, maxWidth, measure, maxLines + 1);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: min, lines: wrapText(text, min, maxWidth, measure, maxLines) };
}

// 字幕折行：最多两行，优先在最靠中间的标点处断，断不开就按宽度折
export function subtitleLines(text: string, size: number, maxWidth: number, measure: Measure): string[] {
  const src = String(text || '').trim(); if (!src) return [];
  if (measure(src, size) <= maxWidth) return [src];
  const mid = src.length / 2;
  const marks = [...src].map((ch, i) => ({ ch, i })).filter(x => '，。、；：！？,.!?;:'.includes(x.ch))
    .sort((a, b) => Math.abs(a.i - mid) - Math.abs(b.i - mid));
  for (const m of marks) {
    if (m.i < 2 || m.i > src.length - 3) continue;
    const a = src.slice(0, m.i + 1), b = src.slice(m.i + 1);
    if (measure(a, size) <= maxWidth && measure(b, size) <= maxWidth) return [a, b];
  }
  return wrapText(src, size, maxWidth, measure, 2);
}
