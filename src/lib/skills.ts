// ===== 创作流程包（技能）：按创作类型定义阶段、问卷、建模文稿、契约与片段规则 =====
// 同一套流程骨架适用于广告 / 故事片 / 剧集 / 短片短视频 / MV / 其他：
// 需求澄清 → 对象建模 → 脚本 → 素材检查 → 分镜 → 片段方案 → 生成成片 → 交付。
// 各类型只替换「建什么模、问什么、守什么契约、单段多长」。Agent 在系统提示里只看到当前阶段的目标、产物、门禁与问卷。
import type { Question } from './types';
import { BRIEF_FORMATS } from './guides';

export type StageId = 'brief' | 'model' | 'script' | 'assets' | 'storyboard' | 'prompts' | 'video' | 'deliver';
export interface StageDef { id: StageId; name: string; goal: string; outputs: string; gate: string; }
export interface QuestionDef extends Question { key: string; }
export interface Skill {
  id: string; name: string; title: string;
  modelName: string;            // 建模阶段的叫法（商品建模 / 人物与世界建模 …）
  modelDocs: string[];          // 建模阶段要写的文稿
  modelGuide: string;           // 建模文稿写什么
  scriptNote: string;           // 脚本阶段的类型特有要求
  general: QuestionDef[];       // 需求澄清阶段的通用问卷
  modeling: QuestionDef[];      // 建模阶段的专项问卷
  contracts: string[];          // 契约：必须遵守的硬规则
  entities: string[];           // 素材完整性检查的实体类型
  clipSeconds: number;          // 单段视频的默认长度
}

export const STAGE_ORDER: StageId[] = ['brief', 'model', 'script', 'assets', 'storyboard', 'prompts', 'video', 'deliver'];
const opt = (label: string, hint?: string) => ({ label, hint });
const single = (key: string, text: string, options: { label: string; hint?: string }[]): QuestionDef => ({ key, text, type: 'single', multi: false, options });
const multi = (key: string, text: string, options: { label: string; hint?: string }[]): QuestionDef => ({ key, text, type: 'multi', multi: true, options });
const text = (key: string, text: string, placeholder: string): QuestionDef => ({ key, text, type: 'text', multi: false, options: [], placeholder });

// 通用阶段骨架；每个技能只改建模阶段的名字与目标
function stages(s: { modelName: string; modelGoal: string; modelDocs: string[]; clipSeconds: number }): StageDef[] {
  return [
    { id: 'brief', name: '需求澄清', goal: '用问卷问清类型、时长、平台与画幅、受众、调性，答案用 save_brief 记录；信息够了就推进，不要反复追问。', outputs: '创作纲领', gate: '纲领里类型、时长、受众、调性齐全' },
    { id: 'model', name: s.modelName, goal: s.modelGoal, outputs: s.modelDocs.map(d => `「${d}」`).join('、'), gate: '建模文稿写完并经用户确认' },
    { id: 'script', name: '脚本', goal: '按写作规范写故事脚本，多场先给大纲再逐场写；写完用自审清单核对。', outputs: '「故事脚本.md」', gate: '脚本通过自审且用户确认' },
    { id: 'assets', name: '素材检查', goal: '列出脚本涉及的实体，判断哪些需要参考图；按契约处理产品 / 人物参考图；生成后把实体和参考图 id 写进台账并请用户确认。', outputs: '参考图（媒体库）与台账里的实体清单', gate: '所有需要参考图的实体都有用户确认过的参考图' },
    { id: 'storyboard', name: '分镜', goal: '按分镜规范把脚本拆成分镜表，镜头总时长与纲领时长一致。', outputs: '「分镜表.md」', gate: '分镜表写完并经用户确认' },
    { id: 'prompts', name: '片段方案', goal: `按总时长和单段上限（默认 ${s.clipSeconds} 秒）把分镜切成若干片段，每段一份视频生成提示词文稿，写明承接哪些镜头、引用哪些参考图；片段清单写进台账 clips；全部写完后用 ask_user 问「确认按此生成 / 需要修改」。`, outputs: '「视频生成Prompt-01..N.md」与台账 clips', gate: '用户确认按此生成' },
    { id: 'video', name: '生成成片', goal: '按片段顺序 generate_video，有参考图就用 from_media_id 或在提示词里复用同一段外形描述；全部生成后用 compose_video 按顺序合成成片。', outputs: '片段视频与成片', gate: '成片合成完成' },
    { id: 'deliver', name: '交付', goal: '总结成片：结构、每段承担的内容、核心信息如何落地；请用户审阅并说明要改哪一段。', outputs: '交付说明', gate: '用户验收' },
  ];
}

const COMMON_GENERAL: QuestionDef[] = [
  single('duration', '成片总时长大概多长？', [opt('15 秒'), opt('30 秒'), opt('60 秒'), opt('3 分钟以内'), opt('5–15 分钟'), opt('更长')]),
  single('ratio', '画幅选哪种？', [opt('竖屏 9:16', '抖音 / 快手 / Reels 等竖屏平台'), opt('横屏 16:9', 'YouTube / B 站 / 大屏'), opt('方屏 1:1', 'Instagram 等方屏')]),
  text('audience', '主要给谁看？', '例如：18–30 岁的都市年轻人 / 新手爸妈 / 品牌老客户'),
];

export const SKILLS: Record<string, Skill> = {
  ad: {
    id: 'ad', name: '营销视频大师', title: '广告',
    modelName: '商品建模', modelDocs: ['商品模型.md', '卖点账本.md'],
    modelGuide: '「商品模型.md」：品牌 / 型号、类目、尺寸与形状、主色与材质、使用场景、目标人群、价格带、有无产品图；「卖点账本.md」：一张表，列 卖点 | 证明方式（画面怎么证明） | 落在哪个片段 | 状态，每个核心卖点至少一行。',
    scriptNote: '按时长选结构（15 / 30 / 60 秒），产品在剧情里自然登场，每个核心卖点在画面里有可见证明，结尾行动号召具体。',
    general: [
      single('subject', '想推广的是什么？', [opt('实物产品'), opt('App 或服务'), opt('品牌形象'), opt('活动或促销')]),
      single('style', '想要什么风格？', [opt('剧情故事型', '一个小故事，产品是情节的一部分'), opt('口播种草型', '一个人对镜头讲'), opt('产品展示型', '画面直接展示产品与功能'), opt('情绪氛围型', '靠画面和音乐带情绪')]),
      ...COMMON_GENERAL,
    ],
    modeling: [
      text('brand', '品牌名或型号是什么？', '比如：SoundBox Mini / 漫游者 S1'),
      single('size', '产品的实际大小大概是多少？', [opt('手掌大小', '可以单手握住'), opt('双手捧持大小', '类似一个大杯奶茶'), opt('桌面级', '类似一台笔记本或音箱'), opt('更大', '需要占据画面主体')]),
      single('shape', '外观形状是什么样的？', [opt('圆柱形'), opt('方盒形'), opt('球形 / 椭圆形'), opt('扁平片状'), opt('其他形状')]),
      text('color', '主色和材质？', '比如：哑光黑 + 织物网面 / 白色磨砂塑料'),
      multi('sellingPoints', '最想让观众记住的卖点是什么？可多选', [opt('便携轻巧'), opt('性能强劲'), opt('外观好看'), opt('续航持久'), opt('智能黑科技'), opt('性价比高'), opt('防水耐用')]),
      single('scene', '故事发生在什么场景？', [opt('都市街头 / 通勤'), opt('聚会 / 派对'), opt('旅行 / 户外'), opt('居家生活'), opt('工作 / 创作场景')]),
      single('productImage', '有没有产品实拍图？', [opt('有，稍后上传', '上传后所有画面以实拍图为准'), opt('没有，让 AI 生成', 'AI 推导的外观可能与真机不同，生成后需要你确认')]),
    ],
    contracts: [
      '产品图契约：没有实拍图时不得直接把 AI 想象的产品写进片段；必须先在 message 里声明「AI 推导外观可能与真机不同」，生成产品三视图（正面 / 侧面 / 45 度）后请用户确认，确认后所有片段引用同一组三视图。',
      '卖点落地契约：卖点账本里每个核心卖点至少在一个片段里有可见证明（动作、对比或结果），只靠字幕或口播说出来的不算。',
      '品牌露出契约：产品或品牌至少露出两次，结尾定帧留出行动号召。',
    ],
    entities: ['产品', '人物', '场景', '道具', '风格锚点'],
    clipSeconds: 15,
  },
  film: {
    id: 'film', name: '故事片导演', title: '故事片',
    modelName: '人物与世界建模', modelDocs: ['人物小传.md', '世界观.md'],
    modelGuide: '「人物小传.md」：每个人物一个二级标题，下面是概况 / 外形（冻结成一段可复用的描述） / 性格 / 欲望与阻碍 / 弧光；「世界观.md」：时代与地点、规则与禁忌、关键场景清单、视觉母题与色调。',
    scriptNote: '三幕或序列结构，每场有价值转换；人物外形与既定事实以人物小传为准；场景数量控制在可生成范围内。',
    general: [
      single('genre', '是什么类型？', [opt('剧情'), opt('悬疑 / 惊悚'), opt('爱情'), opt('科幻 / 奇幻'), opt('喜剧'), opt('其他')]),
      text('theme', '一句话说这个故事讲什么？', '比如：一个不肯回家的人，在雨夜被一只猫带回了家'),
      ...COMMON_GENERAL,
      single('ending', '结局倾向？', [opt('圆满'), opt('悲剧'), opt('开放'), opt('由 Agent 决定')]),
    ],
    modeling: [
      text('protagonist', '主角是谁，最想要什么？', '比如：林晚，26 岁，想在签字前得到一句道歉'),
      text('obstacle', '最大的阻碍或对手是什么？', '比如：她自己的骄傲 / 一个不肯认错的前任'),
      single('world', '故事世界是？', [opt('当代现实'), opt('近未来'), opt('历史时代'), opt('架空 / 奇幻')]),
      single('visual', '视觉风格倾向？', [opt('写实电影感', '自然光、手持、浅景深'), opt('高饱和风格化', '强色彩、构图严整'), opt('黑白 / 低饱和'), opt('动画 / 插画感')]),
      single('castImage', '人物有没有参考图或演员照片？', [opt('有，稍后上传'), opt('没有，让 AI 生成人物形象图', '生成后需要你确认，之后所有镜头复用')]),
    ],
    contracts: [
      '人物一致性契约：每个出场人物先有一段冻结的外形描述和一张确认过的形象图，之后所有片段引用同一段描述 / 同一张图，不得中途改外形。',
      '剧本格式契约：动作行只写可见可听的内容，禁止心理描写与镜头术语。',
      '场景契约：每个反复出现的场景先生成一张场景参考图，后续片段引用它保持空间一致。',
    ],
    entities: ['人物', '场景', '关键道具', '风格锚点'],
    clipSeconds: 10,
  },
  series: {
    id: 'series', name: '剧集主编', title: '剧集',
    modelName: '人物与分集建模', modelDocs: ['人物小传.md', '世界观.md', '分集大纲.md'],
    modelGuide: '「人物小传.md」同故事片；「世界观.md」补人物关系图；「分集大纲.md」：每集一行——集号 | 主线目标 | 关键反转 | 集尾钩子。',
    scriptNote: '每集一个主线目标加一条 B 线，集尾必须留钩子；竖屏短剧前 10 秒进冲突，每 30 秒一个新信息。',
    general: [
      single('kind', '是哪种剧集？', [opt('竖屏短剧', '每集 1–3 分钟'), opt('网剧 / 迷你剧', '每集 10–30 分钟'), opt('长剧', '每集 40 分钟以上')]),
      text('episodes', '计划多少集，每集多长？', '比如：12 集，每集 2 分钟'),
      single('genre', '题材？', [opt('都市情感'), opt('悬疑'), opt('古装 / 历史'), opt('喜剧'), opt('科幻 / 奇幻'), opt('其他')]),
      single('ratio', '画幅选哪种？', [opt('竖屏 9:16'), opt('横屏 16:9')]),
      text('audience', '主要给谁看？', '例如：25–40 岁女性 / 下沉市场男性观众'),
    ],
    modeling: [
      text('protagonist', '主角是谁，整季想要什么？', '比如：梦雨，22 岁记忆搜查科新人，想证明人可以比 AI 更懂人'),
      text('hook', '第一集的钩子是什么？', '比如：她在第一起案子里查到的凶手是自己'),
      single('castImage', '人物有没有参考图？', [opt('有，稍后上传'), opt('没有，让 AI 生成人物形象图')]),
    ],
    contracts: [
      '人物一致性契约：同故事片，所有集共用同一组人物形象图。',
      '钩子契约：每集结尾必须有新信息、危机升级或情感落点之一。',
      '连续性契约：后一集不得改写前一集已发生的事实，改动要先更新人物小传或分集大纲。',
    ],
    entities: ['人物', '场景', '关键道具', '风格锚点'],
    clipSeconds: 10,
  },
  short: {
    id: 'short', name: '短视频制片', title: '短片 / 短视频',
    modelName: '人设与选题建模', modelDocs: ['人设与选题.md', '钩子账本.md'],
    modelGuide: '「人设与选题.md」：出镜人设（是谁、说话方式、外形冻结描述）、选题一句话、目标动作（点赞 / 关注 / 下单）、平台规范；「钩子账本.md」：一张表，列 时间点 | 钩子类型 | 画面 | 状态，前 3 秒必须有一行。',
    scriptNote: '一个主角、一个冲突、一次转折；前 3 秒出钩子，每 10 秒一个新信息，结尾给记忆点或行动指令。',
    general: [
      single('kind', '是哪种内容？', [opt('剧情短片', '有人物和情节'), opt('口播 / 知识', '一个人对镜头讲'), opt('Vlog / 记录'), opt('产品或探店'), opt('氛围 / 混剪')]),
      ...COMMON_GENERAL,
      single('goal', '这条视频最想让观众做什么？', [opt('看完并记住'), opt('点赞 / 转发'), opt('关注账号'), opt('点击 / 下单')]),
    ],
    modeling: [
      text('topic', '选题一句话是什么？', '比如：加班到凌晨的人，怎么用 5 分钟把家变成电影院'),
      single('hookType', '开头用哪种钩子？', [opt('冲突或反差画面'), opt('直接抛问题'), opt('结果先行', '先给最终效果再倒叙'), opt('悬念', '故意不说完')]),
      single('cast', '是否需要真人 / 角色出镜？', [opt('需要，有参考图'), opt('需要，让 AI 生成形象'), opt('不需要出镜')]),
    ],
    contracts: [
      '钩子契约：第一段前 3 秒必须出现钩子账本里的画面。',
      '人设一致性契约：出镜人物有冻结的外形描述与确认过的形象图，所有片段复用。',
      '平台契约：竖屏内容关键信息放在画面中部安全区，字幕不超过两行。',
    ],
    entities: ['人物', '场景', '道具', '风格锚点'],
    clipSeconds: 10,
  },
  mv: {
    id: 'mv', name: 'MV 导演', title: 'MV',
    modelName: '歌曲与意象建模', modelDocs: ['歌曲分析.md', '意象账本.md'],
    modelGuide: '「歌曲分析.md」：歌名 / 艺人、时长、BPM 或节奏感、段落结构（前奏 / 主歌 / 副歌 / 桥段 / 尾奏各自的时间码）、每段情绪、歌词主题；「意象账本.md」：一张表，列 意象 | 出现的段落 | 画面写法 | 递进方式，副歌意象至少一行。',
    scriptNote: '按歌曲段落写「## 段落名 时间码」，每段先写母题再逐句写歌词与画面对位；不图解歌词，副歌递进；标注艺人出镜与对口型。',
    general: [
      text('song', '歌名和艺人是？', '比如：《夜航》 / 独立乐队 The Lanterns'),
      single('mvStyle', 'MV 走哪种路线？', [opt('叙事型', '一条极简故事线'), opt('表演型', '艺人演唱 / 演奏为主'), opt('概念型', '一组反复出现的意象'), opt('混合')]),
      single('mood', '整体情绪？', [opt('温柔 / 治愈'), opt('孤独 / 忧郁'), opt('燃 / 释放'), opt('梦幻 / 迷离'), opt('复古 / 怀旧')]),
      text('duration', '歌曲时长多少？', '比如：3 分 42 秒；先做副歌 60 秒版也可以'),
      single('ratio', '画幅选哪种？', [opt('横屏 16:9'), opt('竖屏 9:16'), opt('宽银幕 2.35:1', '按 16:9 生成再裁切')]),
    ],
    modeling: [
      text('structure', '歌曲段落和时间码？', '比如：前奏 0:00–0:15，主歌 A 0:15–0:45，副歌 0:45–1:10…'),
      multi('motifs', '想反复出现的核心意象？可多选', [opt('灯光 / 霓虹'), opt('水 / 雨'), opt('公路 / 行走'), opt('镜子 / 倒影'), opt('花 / 植物'), opt('窗 / 房间'), opt('人群 / 城市')]),
      single('artistImage', '艺人有没有形象参考图？', [opt('有，稍后上传'), opt('没有，让 AI 生成形象'), opt('不出镜')]),
      single('palette', '色调？', [opt('冷色夜景'), opt('暖色胶片'), opt('高饱和霓虹'), opt('黑白')]),
    ],
    contracts: [
      '对位契约：每段画面必须与歌曲时间码对齐，段落总时长等于歌曲时长（或用户指定的剪辑版时长）。',
      '递进契约：副歌每次重复画面必须升级，不得复用同一段。',
      '艺人一致性契约：艺人有冻结外形描述与确认过的形象图，所有出镜片段复用。',
    ],
    entities: ['艺人 / 人物', '场景', '意象道具', '风格锚点'],
    clipSeconds: 10,
  },
  other: {
    id: 'other', name: '通用创作助手', title: '其他',
    modelName: '对象建模', modelDocs: ['创作脑图.md'],
    modelGuide: '「创作脑图.md」：目标、观众、核心信息、涉及的人物 / 物件 / 场景、风格与调性、时长与画幅。',
    scriptNote: '先定目标、主角、阻碍、变化，再动笔。',
    general: [text('goal', '这段内容想达到什么目的？', '比如：给公司年会开场 / 给孩子讲一个睡前故事'), ...COMMON_GENERAL],
    modeling: [text('subjects', '会出现哪些人物、物件或场景？', '比如：一位老船长、一艘旧渔船、清晨的码头'), single('castImage', '人物或物件有没有参考图？', [opt('有，稍后上传'), opt('没有，让 AI 生成'), opt('不需要')])],
    contracts: ['一致性契约：反复出现的人物或物件先有确认过的参考图，之后复用。'],
    entities: ['人物', '物件', '场景', '风格锚点'],
    clipSeconds: 10,
  },
};

export function skillFor(format?: string): Skill { return SKILLS[String(format || '')] || SKILLS.other; }
export function skillStages(skill: Skill): StageDef[] {
  const goal: Record<string, string> = {
    ad: '用专项问卷把产品问清楚，然后写「商品模型.md」和「卖点账本.md」；有实拍图先让用户上传。',
    film: '用专项问卷定主角、阻碍、世界与视觉风格，然后写「人物小传.md」和「世界观.md」，人物外形写成可复用的冻结描述。',
    series: '定主角、第一集钩子与分集节奏，写「人物小传.md」「世界观.md」「分集大纲.md」。',
    short: '定人设与选题，写「人设与选题.md」和「钩子账本.md」。',
    mv: '拿到歌曲段落与时间码，写「歌曲分析.md」和「意象账本.md」。',
    other: '问清涉及的对象，写「创作脑图.md」。',
  };
  return stages({ modelName: skill.modelName, modelGoal: (goal[skill.id] || goal.other) + ' ' + skill.modelGuide, modelDocs: skill.modelDocs, clipSeconds: skill.clipSeconds });
}
export function stageName(skill: Skill, id: StageId): string { return skillStages(skill).find(s => s.id === id)?.name || id; }
export function formatTitle(format?: string): string { return BRIEF_FORMATS[String(format || '')] || '其他'; }
