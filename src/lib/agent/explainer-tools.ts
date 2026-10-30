// ===== 科普流水线的工具：转写 → 知识点 → 配音 → 渲染 =====
// 和影视类工具的区别：这里没有「调用视频模型」，画面全由 render_scene 用代码画出来，所以渲染不计费、可以反复重来。
import type { Artifact, MessageAction } from '../types';
import { useFiles, findDoc, findDocByName, findMedia } from '../store';
import { ensureExt, sanitizeName, wordCount } from '../markdown';
import { fetchCaptions } from '../helper';
import { parseCaptions, transcriptMarkdown, chunkTranscript, youtubeId, formatTimecode } from '../transcript';
import { lintNarration, KNOWLEDGE_GUIDE } from '../guides';
import { callModel, chatCfg, modelCfg, parsePlanJSON } from '../model';
import { lintSpec, normalizeSpec, parseSpec, timelineOf, estimateSeconds, type Beat, type SceneSpec } from '../render/spec';
import { renderScene } from '../render/video';
import { generateSpeech, mediaReadyReason, DEFAULT_VOICE_ID } from '../mediagen';
import type { ToolContext, ToolFn, ToolResult } from './tools';

const openDocAction = (id: string, name: string): MessageAction => ({ id: 'open-doc:' + id, label: `打开「${name.slice(0, 14)}」` });
const docArtifact = (id: string, name: string): Artifact => ({ id, kind: 'doc', name });
function requireDoc(id: unknown) { const d = findDoc(String(id || '').trim()); if (!d) throw new Error(`找不到 id 为「${id}」的文稿，请从文件清单里选择`); return d; }

// 写入或覆盖一份文稿，返回文稿 id（工具内部用，带逐行写入动画）
async function writeDoc(ctx: ToolContext, name: string, content: string, kind: 'md' | 'json' = 'md') {
  const full = ensureExt(sanitizeName(name), kind);
  const files = useFiles.getState();
  const existing = files.docs.find(d => d.name.toLowerCase() === full.toLowerCase());
  if (existing) { await ctx.step(`重写「${existing.name}」`, () => ctx.typeInto(existing.id, '', content + '\n')); return existing; }
  const doc = files.addDoc({ name: full, content: '', kind, by: 'agent', chatId: ctx.chatId });
  await ctx.step(`新建「${doc.name}」并写入正文`, () => ctx.typeInto(doc.id, '', content + '\n'));
  return findDoc(doc.id)!;
}

// 画面方案文稿：按名字或 id 找，找不到就报出有哪些可选
function requireSpecDoc(id: unknown) {
  const key = String(id || '').trim();
  const doc = findDoc(key) || findDocByName(key) || (key ? null : null);
  if (!doc) {
    const names = useFiles.getState().docs.filter(d => /^画面-/.test(d.name)).map(d => `${d.id}（${d.name}）`);
    throw new Error(`找不到画面方案「${key}」${names.length ? `；现有的是：${names.join('、')}` : '；先用 write_doc 写一份「画面-01.json」'}`);
  }
  const spec = parseSpec(doc.content);
  if (!spec) throw new Error(`「${doc.name}」不是合法的 JSON，没法当画面方案用`);
  return { doc, spec };
}
const saveSpec = (docId: string, spec: SceneSpec) => useFiles.getState().updateDoc(docId, { content: JSON.stringify(spec, null, 2), by: 'agent' });

export const EXPLAINER_TOOLS: Record<string, ToolFn> = {
  // ---- 课程转写 ----
  async import_transcript(args, ctx): Promise<ToolResult> {
    const url = String(args.url || '').trim();
    const srcDoc = args.doc_id ? requireDoc(args.doc_id) : null;
    const raw = String(args.text || '').trim();
    let captions = '', meta: { title?: string; url?: string; lang?: string; auto?: boolean; duration?: number } = {};
    if (url) {
      if (!/^https?:\/\//.test(url)) throw new Error('链接要以 http(s) 开头');
      await ctx.step(`抓取课程字幕（${youtubeId(url) ? 'YouTube ' + youtubeId(url) : url.slice(0, 40)}）`, async () => {
        ctx.live('本机助手正在抓字幕…');
        const r = await fetchCaptions(url, String(args.lang || 'zh,zh-Hans,en'));
        captions = r.captions; meta = { title: r.title, url: r.url, lang: args.lang ? String(args.lang) : undefined, auto: r.auto, duration: r.duration };
      });
    } else if (srcDoc) { captions = srcDoc.content; meta = { title: String(args.title || srcDoc.name.replace(/\.[^.]+$/, '')) }; }
    else if (raw) { captions = raw; meta = { title: String(args.title || '用户提供的内容') }; }
    else throw new Error('缺少来源：给 url（课程链接）、doc_id（已上传的字幕 / 文稿）或 text（直接粘贴的文字）三者之一');

    const cues = parseCaptions(captions);
    if (!cues.length) throw new Error('这份素材里没解析出任何内容，确认一下是不是字幕或文字稿');
    if (args.title) meta.title = String(args.title);
    const md = transcriptMarkdown(cues, meta);
    const doc = await writeDoc(ctx, `转写稿-${sanitizeName(String(meta.title || '课程')).slice(0, 20)}`, md);
    useFiles.getState().openInPane(doc.id);
    const total = cues[cues.length - 1].end;
    return {
      summary: `已转写《${meta.title || '课程'}》：${formatTimecode(total, true)}、${cues.length} 段、${wordCount(md)} 字${meta.auto ? '（自动字幕，专有名词可能有错）' : ''}`,
      actions: [openDocAction(doc.id, doc.name)], artifact: docArtifact(doc.id, doc.name),
    };
  },

  // ---- 知识点梳理：逐块过模型，合并成一张表 ----
  async extract_points(args, ctx): Promise<ToolResult> {
    const cfg = modelCfg(); if (!cfg?.apiKey) throw new Error('还没配置模型，先在「模型」里填好再用');
    const doc = args.doc_id ? requireDoc(args.doc_id) : useFiles.getState().docs.find(d => /^转写稿/.test(d.name));
    if (!doc) throw new Error('找不到转写稿，先用 import_transcript 建立');
    const chunks = chunkTranscript(doc.content);
    const wcfg = chatCfg(cfg, 'compile');
    const rows: { topic: string; one: string; why: string; level: string; at: string }[] = [];
    const sys = `你从一段课程转写稿里挑出值得单独做成一条 60 秒科普短视频的知识点。只输出 JSON：{"points":[{"topic":"知识点名（名词短语，不超过 14 字）","one":"一句话说清楚（人话，不超过 25 字）","why":"为什么值得单独做一条（观众的获得感，不超过 20 字）","level":"入门|进阶","at":"[12:34] 或 [12:34-15:02]"}]}。
规矩：① 只挑讲清楚了的、观众有获得感的，宁可少挑；寒暄、课程安排、作业要求、设备问题一律不要。② at 必须取自原文里出现过的时间码。③ topic 用你自己的概括，不要照抄老师的原话。④ 这一块挑不出就返回空数组。⑤ 每块最多 6 条。
${KNOWLEDGE_GUIDE}`;
    for (let i = 0; i < chunks.length; i++) {
      if (ctx.signal?.aborted) break;
      await ctx.step(`梳理第 ${i + 1}/${chunks.length} 块转写稿`, async () => {
        ctx.live(`梳理知识点 ${i + 1}/${chunks.length}…`);
        const out = parsePlanJSON(await callModel(wcfg, sys, chunks[i], { signal: ctx.signal }));
        for (const p of (Array.isArray(out?.points) ? out.points : [])) {
          const topic = String(p?.topic || '').trim(); if (!topic) continue;
          if (rows.some(r => r.topic === topic)) continue;
          rows.push({ topic: topic.slice(0, 20), one: String(p?.one || '').trim().slice(0, 40), why: String(p?.why || '').trim().slice(0, 30), level: /进阶/.test(String(p?.level)) ? '进阶' : '入门', at: String(p?.at || '').trim().slice(0, 20) });
        }
      });
    }
    if (!rows.length) throw new Error('这份转写稿里没挑出够格的知识点，确认一下内容是不是对的');
    const head = `# 知识点清单\n\n> 来自「${doc.name}」，共 ${rows.length} 条。「选做」一列由选题排期阶段填。\n\n| 编号 | 知识点 | 一句话说清楚 | 为什么值得单独做一条 | 难度 | 来源时间码 | 选做 |\n|---|---|---|---|---|---|---|\n`;
    const body = rows.map((r, i) => `| ${String(i + 1).padStart(2, '0')} | ${r.topic} | ${r.one} | ${r.why} | ${r.level} | ${r.at} |  |`).join('\n');
    const out = await writeDoc(ctx, '知识点清单', head + body + '\n');
    useFiles.getState().openInPane(out.id);
    return { summary: `从「${doc.name}」里梳理出 ${rows.length} 个知识点`, actions: [openDocAction(out.id, out.name)], artifact: docArtifact(out.id, out.name) };
  },

  // ---- 自查：口播稿与画面方案（免确认，结果交回模型）----
  async lint_narration(args): Promise<ToolResult> {
    const docs = args.doc_id ? [requireDoc(args.doc_id)] : useFiles.getState().docs.filter(d => /^口播-/.test(d.name));
    if (!docs.length) throw new Error('没找到口播稿（「口播-NN.md」）');
    const lines: string[] = []; let bad = 0;
    for (const d of docs) {
      const issues = lintNarration(d.content);
      bad += issues.length;
      lines.push(`《${d.name}》${issues.length ? '：\n' + issues.map(x => '  ✗ ' + x).join('\n') : '：✓ 通过'}`);
    }
    return { summary: bad ? `口播自查发现 ${bad} 处问题` : `口播自查通过（${docs.length} 份）`, content: lines.join('\n') };
  },
  async lint_scene(args): Promise<ToolResult> {
    const docs = args.doc_id ? [requireDoc(args.doc_id)] : useFiles.getState().docs.filter(d => /^画面-/.test(d.name));
    if (!docs.length) throw new Error('没找到画面方案（「画面-NN.json」）');
    const lines: string[] = []; let bad = 0;
    for (const d of docs) {
      const spec = parseSpec(d.content);
      if (!spec) { bad++; lines.push(`《${d.name}》：✗ 不是合法 JSON`); continue; }
      const issues = lintSpec(spec); bad += issues.length;
      const tl = timelineOf(spec);
      lines.push(`《${d.name}》（${spec.beats.length} 段，预计 ${Math.round(tl.total)} 秒）${issues.length ? '：\n' + issues.map(x => '  ✗ ' + x).join('\n') : '：✓ 通过'}`);
    }
    return { summary: bad ? `画面方案自查发现 ${bad} 处问题` : `画面方案自查通过（${docs.length} 份）`, content: lines.join('\n') };
  },

  // ---- 逐句配音：真实音频时长写回 beat.seconds，声画从此对齐 ----
  async narrate_scene(args, ctx): Promise<ToolResult> {
    const reason = mediaReadyReason(); if (reason) throw new Error(reason);
    const { doc, spec } = requireSpecDoc(args.doc_id);
    const sampleId = String(args.voice_media_id || '').trim();
    const sample = sampleId ? findMedia(sampleId) : null;
    if (sampleId && !sample) throw new Error(`找不到音色样本 ${sampleId}`);
    if (sample && !sample.voiceId) throw new Error(`「${sample.name}」没有 voice id（不是用 generate_voice 设计的样本）`);
    const voiceId = sample?.voiceId || DEFAULT_VOICE_ID;
    const speed = args.speed !== undefined ? Number(args.speed) : 1;
    const todo = spec.beats.map((b, i) => ({ b, i })).filter(({ b }) => b.say && !b.voiceId);
    if (!todo.length) return { summary: `「${doc.name}」的每句都已经配过音了`, actions: [openDocAction(doc.id, doc.name)] };
    let done = 0;
    for (const { b, i } of todo) {
      if (ctx.signal?.aborted) break;
      await ctx.step(`配音第 ${i + 1}/${spec.beats.length} 句（${b.say.length} 字）`, async () => {
        ctx.live(`配音 ${done + 1}/${todo.length}…`);
        const r = await generateSpeech({ text: b.say, voiceId, name: `${spec.title}-${String(i + 1).padStart(2, '0')}`, group: '配音', speed }, { onProgress: ctx.live, signal: ctx.signal, task: { chatId: ctx.chatId, messageAt: ctx.messageAt, stepIndex: ctx.stepIndex } });
        spec.beats[i].voiceId = r.item.id;
        // 真实音频时长就是这一段画面的时长，留 0.25 秒气口；读不到时长就按字数估
        spec.beats[i].seconds = Math.round(((r.item.duration || estimateSeconds(b.say)) + 0.25) * 100) / 100;
        saveSpec(doc.id, spec);   // 每句写一次，中途停了也不丢
        done++;
      });
    }
    const total = timelineOf(spec).total;
    return {
      summary: `「${doc.name}」配好 ${done} 句，按真实语速全片 ${Math.round(total)} 秒`,
      actions: [openDocAction(doc.id, doc.name)],
      content: `每句的时长已写回画面方案，画面会按它排，声画对齐。全片 ${total.toFixed(1)} 秒。`,
    };
  },

  // ---- 渲染：代码画帧 + 配音 + 字幕 → MP4 ----
  async render_scene(args, ctx): Promise<ToolResult> {
    const { doc, spec } = requireSpecDoc(args.doc_id);
    const issues = lintSpec(spec);
    if (issues.length && !args.force) throw new Error(`画面方案还有问题，改完再渲染（想先看效果就加 force: true）：${issues.slice(0, 3).join('；')}`);
    const noVoice = spec.beats.every(b => !b.voiceId);
    let item!: import('../types').MediaItem;
    await ctx.step(`渲染「${spec.title}」（${spec.beats.length} 段，约 ${Math.round(timelineOf(spec).total)} 秒）`, async () => {
      item = await renderScene(spec, {
        name: String(args.name || spec.title),
        signal: ctx.signal,
        onProgress: (text) => ctx.live(text),
      });
    });
    useFiles.getState().openInPane(item.id);
    return {
      summary: `已渲染「${item.name}」（${item.duration} 秒，${item.width}×${item.height}${noVoice ? '，无配音' : ''}）`,
      actions: [{ id: 'open-media:' + item.id, label: '查看成片' }],
      artifact: { id: item.id, kind: 'video', name: item.name },
      content: noVoice ? '这一版没有配音（画面方案里的 beat 都没有 voiceId），时长是按字数估的；配音之后重渲染会更准。' : undefined,
    };
  },
};

// 从口播稿生成画面方案的骨架：每行一句 → 一个 beat，模板按「｜」后的画面提示和内容特征猜，模型再调整
export function scaffoldSpec(narration: string, base: Partial<SceneSpec> = {}): SceneSpec {
  const lines = String(narration || '').split('\n').map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('>') && !l.startsWith('|'))
    .map(l => l.replace(/^[-*\d.、]+\s*/, ''));
  const beats: Beat[] = lines.map((line, i) => {
    const [say, hint = ''] = line.split('｜');
    const t = say.trim();
    let template: Beat['template'] = 'bullets';
    if (i === 0) template = 'hook';
    else if (i === lines.length - 1) template = 'endcard';
    else if (/\d/.test(t) && /倍|%|％|秒|年|次|万|亿|个/.test(t)) template = 'number';
    else if (/比|不是.*是|以前|现在|错|对/.test(t)) template = 'compare';
    else if (/第一|首先|然后|接着|最后|步/.test(t)) template = 'steps';
    else if (/叫做|术语|称为|名字/.test(t)) template = 'term';
    if (/大字|标题/.test(hint)) template = 'hook';
    if (/图表|数据|曲线/.test(hint)) template = 'chart';
    if (/引用|原话/.test(hint)) template = 'quote';
    return { say: t, template, seconds: estimateSeconds(t), heading: hint.trim() || undefined } as Beat;
  });
  return normalizeSpec({ ...base, beats });
}
