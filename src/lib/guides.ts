// ===== 写作规范 / 剧本格式硬规则 / 分镜规范：按创作纲领的类型注入 Agent 提示（从旧版 14 / 15 / 16 移植） =====
export const BRIEF_FORMATS: Record<string, string> = { series: '剧集', film: '电影', short: '短片', ad: '广告', other: '其他' };
export const BRIEF_FIELDS: [string, string][] = [['format', '类型'], ['duration', '时长'], ['platform', '平台'], ['audience', '受众'], ['tone', '调性'], ['references', '参考作品'], ['visualStyle', '视觉风格'], ['taboos', '禁忌'], ['notes', '备注']];
export const BRIEF_KEY_FIELDS = ['format', 'duration', 'audience', 'tone'];

interface Guide { name: string; structure: string; format: string; dialogue: string; checklist: string; }
const WRITING_GUIDES: Record<string, Guide> = {
  series: {
    name: '剧集',
    structure: '每集围绕一个主线目标，配一条情感或悬念 B 线；开场 30–60 秒内进入冲突（冷开场优先）；中段至少一次翻转；集尾留钩子（新信息、危机升级或情感落点）。竖屏短剧每集 1–3 分钟，每 30 秒要有一个新信息或反转，第 1 集前 10 秒必须出现冲突。人物弧光按季分配，单集只推进一小步。',
    format: '中文剧本。场景标题写 INT./EXT. 地点 - 时间；动作行只写看得见听得着的内容，每段不超过 3 行；人物名首次出场大写并加年龄与一句外形；对白前不写"说道"；每页约 1 分钟。',
    dialogue: '对白短、口语、有潜台词，避免人物把心里话直接说出来；两人对话尽量有权力或信息差；用动作打断对白制造节奏；每场结尾一句或一个画面收束。',
    checklist: '这场戏的目标是什么；主角想要什么、阻碍是什么；场景开始与结束时状态有无变化；是否推进主线或人物关系；有没有可拍的关键画面；集尾钩子是否成立；是否与人物卡和前情矛盾。',
  },
  film: {
    name: '电影',
    structure: '三幕结构：激励事件在前 10% 出现，第一幕结束于 25% 左右的不可逆选择，中点反转改变目标或认知，第二幕末低谷，第三幕高潮对应主题。按序列（8–12 个）组织，每个序列有自己的目标与结果；每场都有价值转换（从 A 到 -A）。90–120 分钟约 90–120 页。',
    format: '中文剧本。场景标题 INT./EXT. 地点 - 时间；动作行简洁具体、可拍，每段不超过 4 行；镜头术语只在必要时写；重要道具与视觉母题首次出现时写清楚；每页约 1 分钟。',
    dialogue: '对白服务于人物与冲突，少解释剧情；长短场交替控制节奏；用视觉动作代替说明；重复出现的母题在关键节点回响；结尾呼应开场。',
    checklist: '主角欲望与需求是否分明；每场有无进出变化；转折点是否落在合理位置；主题是否通过行动而非台词表达；配角是否各有功能；节奏上有没有连续三场同样长度和情绪；与人物卡、前情是否一致。',
  },
  short: {
    name: '短片',
    structure: '一个主角、一个核心冲突、一次真正的转折。前 30 秒建立情境与欲望；中段压力持续升级；结尾用反转或情感落点收束，不做多线。人物不超过 3 个，场景不超过 3 个；每分钟至少有一个新的信息增量。',
    format: '中文剧本。场景标题 INT./EXT. 地点 - 时间；动作行短促、画面感强，每段不超过 3 行；尽量少的转场；每页约 1 分钟，5 分钟短片控制在 5 页左右。',
    dialogue: '对白克制，能用画面就不用台词；沉默和停顿是节奏工具；结尾一句台词或一个动作要能被记住；避免开场用对白交代背景。',
    checklist: '一句话能否说清这个短片讲什么；冲突是否在前 30 秒建立；转折是否出人意料又合理；人物和场景数量是否克制；结尾是否与开场形成对照；预算内能否拍出来。',
  },
  ad: {
    name: '广告',
    structure: '按时长定结构。15 秒：0–3 秒钩子（冲突或强画面，可无台词）→ 3–11 秒单一利益点与产品自然登场 → 11–15 秒行动号召与品牌露出。30 秒：痛点 → 转折 → 产品 → 证明或对比 → 行动号召。60 秒品牌片：完整的小故事弧，产品是情感落点而非主角。信息流竖屏前 2 秒必须有冲突画面，品牌露出至少 2 次。',
    format: '每条分镜写清：时码（秒）、画面、口播或对白、字幕、音效与音乐、画面比例；口播按中文每秒 3–4 字核算；产品名与 slogan 用原文，slogan 不超过 12 字；标注需要的道具与场景，控制在可执行预算内。',
    dialogue: '口播口语化、短句、动词开头；一次只讲一个利益点；结尾行动号召具体（做什么、去哪里）；避免形容词堆砌，用画面证明卖点。',
    checklist: '钩子是否在 3 秒内；利益点是否只有一个且明确；口播字数与时长是否匹配；品牌露出次数与位置；行动号召是否具体；有没有违反禁忌或平台规范；预算内可拍。',
  },
  other: {
    name: '通用',
    structure: '先确定这段内容的目标、主角想要什么、阻碍是什么、结尾变化是什么，再动笔；结构服从目标。',
    format: '中文剧本。场景标题 INT./EXT. 地点 - 时间；动作行只写可见可听、每段不超过 3 行；对白简洁；每页约 1 分钟。',
    dialogue: '对白有潜台词，少解释；动作推动节奏；每场有收束。',
    checklist: '目标、冲突、变化是否清楚；是否可拍；是否与人物卡和前情矛盾。',
  },
};
export function writingGuideText(format?: string): string {
  const g = WRITING_GUIDES[format || ''] || WRITING_GUIDES.other;
  return `【${g.name}写作规范】结构：${g.structure}\n格式：${g.format}\n对白与节奏：${g.dialogue}\n自查清单（写完逐条核对，不合格就改）：${g.checklist}`;
}
export function writingChecklist(format?: string): string { return (WRITING_GUIDES[format || ''] || WRITING_GUIDES.other).checklist; }

const SCRIPT_RULES = {
  headingText: '场景标题写成「## INT. 地点 - 时间」或「## EXT. 地点 - 时间」（内外景同时用 INT./EXT.），时间用 日 / 夜 / 晨 / 黄昏 / 深夜 等；每场一个二级标题，标题里不写编号、不写其他内容。',
  headingExample: '## INT. 雨夜车内 - 夜',
  virtual: ['想起', '想到', '回忆起', '回想', '想着', '觉得', '感觉到', '感到', '意识到', '明白了', '心里', '心中', '内心', '暗自', '不由得', '仿佛', '决定', '打算', '希望', '害怕', '担心', '以为', '记得', '忘不了', '知道', '在想', '似乎在'],
  unfilmable: ['与此同时在', '多年前', '多年以后', '若干年后', '很久以前', '观众', '镜头之外', '内心独白', '此时的她', '此时的他', '我们看到', '我们看见', '画外之意'],
  camera: ['特写', '近景', '中景', '远景', '全景', '推镜', '拉镜', '摇镜', '移镜', '跟拍', '切至', '切到', '淡入', '淡出', '叠化', '镜头对准', '镜头从', '镜头拉', '镜头推', '画面切换', '俯拍', '仰拍', '空镜'],
  parenMaxChars: 20,
};
export function formatRulesText(): string {
  const c = SCRIPT_RULES;
  return `【剧本格式硬规则（Markdown 剧本）】\n1. ${c.headingText} 例：${c.headingExample}\n2. 人物对白写成「**人物名**」独占一行，下一行是台词；括注写在人物名后的括号里（如 **梦雨**（低声）），只写演法或说话对象，不超过 ${c.parenMaxChars} 字。\n3. 动作行只写镜头能拍到、话筒能录到的内容：可见的动作、表情、道具、环境、声音。禁止虚写——不写心理活动、回忆、动机、判断，含「${c.virtual.slice(0, 12).join('、')}」等词的句子必须改成外在动作。\n4. 禁止不可拍内容：叙述者口吻、对观众说话、时空跳跃说明（「${c.unfilmable.slice(0, 5).join('、')}」等）。\n5. 不写镜头术语（${c.camera.slice(0, 6).join('、')}等），除非用户明确要求分镜级剧本。\n6. 人物名首次出场时在动作行里给出年龄与一句外形；对白的人物名必须与人物文档或已出场人物一致。`;
}

// 剧本 MD 的轻量校验：只查动作行里的虚写与不可拍词、镜头术语（供自审提示与结果里的提醒）
export interface LintIssue { line: number; level: 'error' | 'warn'; message: string; snippet: string; }
export function lintScriptMarkdown(md: string, { allowCamera = false } = {}): LintIssue[] {
  const issues: LintIssue[] = []; const c = SCRIPT_RULES;
  String(md || '').split('\n').forEach((raw, i) => {
    const text = raw.trim(); if (!text || /^#/.test(text) || /^\*\*.+\*\*/.test(text) || /^[-*|>]/.test(text)) return;
    const prev = i > 0 ? String(md).split('\n')[i - 1].trim() : '';
    if (/^\*\*.+\*\*/.test(prev)) return;   // 台词行不查
    const v = c.virtual.find(w => text.includes(w)); if (v) issues.push({ line: i + 1, level: 'error', message: `动作行含虚写「${v}」，镜头拍不到`, snippet: text.slice(0, 60) });
    const u = c.unfilmable.find(w => text.includes(w)); if (u) issues.push({ line: i + 1, level: 'error', message: `动作行含不可拍内容「${u}」`, snippet: text.slice(0, 60) });
    if (!allowCamera) { const cam = c.camera.find(w => text.includes(w)); if (cam) issues.push({ line: i + 1, level: 'warn', message: `动作行含镜头术语「${cam}」，剧本阶段不写镜头`, snippet: text.slice(0, 60) }); }
  });
  return issues;
}

const SHOT_GUIDES: Record<string, { name: string; rules: string }> = {
  ad: { name: '广告', rules: '前 3 秒必须有视觉钩子（产品、冲突或反差画面）；单镜 1–3 秒，15 秒约 6–10 个镜头；产品或品牌至少露出 2 次，结尾定帧留 1 秒给 logo；口播 / 字幕对应的画面用近景或特写承接；节奏由快到稳，最后一镜承接行动号召。' },
  short: { name: '短剧', rules: '开场第一镜直接进冲突，不铺陈环境；对白场用正反打加反应镜头，每句关键台词至少一个近景；单镜 2–5 秒，节奏快；情绪转折点给特写；每场结尾留一个钩子镜头（悬念或反转）。' },
  series: { name: '剧集', rules: '每场先给定场镜头交代空间关系，再进中景、近景；对白按信息差安排正反打与过肩；关键动作和道具给插入特写；情绪高点用推镜或特写；一场 6–15 个镜头，单镜 3–8 秒。' },
  film: { name: '电影', rules: '镜头服务于视点与情绪：先决定这一场是谁的视点，景别由远到近推进或有意反向；长镜头与场面调度优先于碎切；动作段落按空间逻辑分解、保持轴线一致；关键道具、手部动作、眼神给特写；控制镜头数量，宁少勿碎。' },
  other: { name: '通用', rules: '每场先定场（全景或中景交代空间与人物位置），再按叙事节拍推进景别；每句关键对白有承接镜头；动作段落分解为可拍的单一动作；情绪转折给特写或推镜；单镜 2–8 秒；一段正文一般不超过 3 个镜头，也不要一段一镜地机械切分。' },
};
export function shotGuideText(format?: string): string {
  const g = SHOT_GUIDES[format || ''] || SHOT_GUIDES.other;
  return `【${g.name}分镜规范】${g.rules}\n分镜表用 Markdown 表格，列：镜号 | 场次 | 景别 | 角度 | 运镜 | 时长(秒) | 画面描述 | 台词 / 音效 | 剧本依据。每个镜头一行，画面描述写主体 + 动作 + 构图，不逐字复制剧本原文。`;
}

export const PROMPT_GUIDE = `【视频生成提示词规范】每个镜头一份文档，命名「视频生成Prompt-两位镜号.md」。结构：# 镜头信息（镜号、场次、时长、画幅）；## 画面（主体、动作、环境、光线、色调，按画面出现顺序写，具体可见）；## 镜头（景别、角度、运镜）；## 风格（参考风格、质感、氛围关键词）；## 人物与资产（引用人物文档或图片文件名，保持外形一致）；## 负面约束（不要出现的内容）；## 英文 Prompt（一段可直接粘贴给视频模型的英文提示词，80–150 词）。`;
