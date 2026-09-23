// ===== 数据模型：所有产物都是文件——文稿（MD / JSON / TXT）与媒体（图片 / 视频） =====
export type DocKind = 'md' | 'json' | 'txt';
export type Origin = 'agent' | 'user' | 'import';

export interface Doc {
  id: string;
  name: string;           // 含扩展名，如「故事脚本.md」
  kind: DocKind;
  content: string;
  createdAt: number;
  updatedAt: number;
  by: Origin;
  chatId?: string | null; // 由哪次对话产出
}

export type MediaKind = 'image' | 'video' | 'audio';   // audio：上传的配乐 / 音效，合成成片时当 BGM

export interface MediaItem {
  id: string;             // IndexedDB 里 blob 的键
  name: string;
  kind: MediaKind;
  mime: string;
  size: number;
  group: string;          // 分区：人物 / 场景 / 产品 / 其他…
  createdAt: number;
  by: Origin;
  width?: number;
  height?: number;
  model?: string;         // 生成它的模型名（智能匹配时可能不是面板里排第一的那个）
  duration?: number;      // 视频 / 音频时长（秒），合成成片时写入
  voiceId?: string;       // 音色样本：声音模型返回的 voice id，合成配音时用它
  compose?: ComposeRecipe; // 本地合成的成片记它的配方，导出剪映草稿时按它铺配乐 / 配音 / 字幕轨
}

// 成片的合成配方：由哪几段拼成（按顺序）、配乐与音量、片段原声音量、字幕（秒）、配音（媒体 id + 起点秒）
export interface ComposeRecipe { clips: string[]; musicId?: string; musicVolume?: number; clipVolume?: number; subtitles?: { start: number; end: number; text: string }[]; voices?: { id: string; start: number; volume?: number }[]; }

export interface TrashEntry { trashId: string; deletedAt: number; doc?: Doc; media?: MediaItem; }

export interface Brief {
  format?: string; duration?: string; platform?: string; ratio?: string; audience?: string; tone?: string;
  references?: string; visualStyle?: string; taboos?: string; notes?: string; updatedAt?: number;
}

export interface UiPrefs {
  paneOpen: boolean;
  paneWidth: number;      // 右侧工作区宽度（px）
  view: 'grid' | 'list';
  openId: string | null;  // 工作区里打开的文稿 / 媒体 id
  sidebarCollapsed: boolean;
}

// ===== 对话 =====
export interface FollowUp { label: string; prompt: string; action?: 'nle'; }   // action：点了执行本地动作而不是把 prompt 发给模型（nle = 导入到剪辑软件）
// 追问：single 单选 / multi 多选 / text 填空；选项可带一行说明；key 用来把答案记进台账
export interface QuestionOption { label: string; hint?: string; }
export interface Question { text: string; type?: 'single' | 'multi' | 'text'; options: QuestionOption[]; multi: boolean; placeholder?: string; key?: string; recommended?: number[]; }   // recommended：推荐选项下标，本地问卷会预选
export interface Artifact { id: string; kind: 'doc' | 'image' | 'video' | 'audio'; name: string; prompt?: string; }   // 执行结果里的产物卡片；生成类带上提示词供质检
export interface ImageCheck { id: string; name: string; verdict: '通过' | '需重生成'; description: string; issues: string[]; }   // 视觉模型对参考图的质检结果
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export interface PlanStep { tool: string; kind: string; title: string; preview: string; destructive: boolean; status: StepStatus; result: string; logs: string[]; }
export type PlanState = 'pending' | 'confirmed' | 'cancelled' | 'running' | 'reviewing' | 'done' | 'stopped' | 'error';
export interface Plan { key?: string; steps: PlanStep[]; state: PlanState; destructive?: number; reviewing?: string; }   // reviewing：自审 / 质检阶段显示在卡头的说明（正在自审《故事脚本.md》）
export interface ReviewIssue { point: string; fix: string; }
export interface ReviewItem { docId: string; title: string; verdict: '通过' | '需修改'; score: number | null; praise: string; issues: ReviewIssue[]; }
export interface Review { items: ReviewItem[]; at: number; handled?: boolean; }   // handled：用户已经就自审意见做过选择（去修 / 不改），按钮收起、一键模式可以继续
export interface MessageAction { id: string; label: string; }

export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;                        // 交给模型的完整文本
  display?: string;                    // 气泡里显示的文案（问卷提交后显示「我已确认以上信息」，答案仍在 text 里）
  at: number;
  thinking?: string;
  streaming?: boolean;
  quote?: { text: string; source?: string } | null;
  attachments?: string[];              // 引用的媒体 id
  questions?: Question[];
  answers?: Record<number, number[]>;
  textAnswers?: Record<number, string>;   // 填空题与「自己填写」的答案
  decided?: number[];                    // 交给 Agent 决定的题（下标）——「由 Agent 决定」只针对当前这一题
  questionsUsed?: boolean;
  artifacts?: Artifact[];
  imageReview?: ImageCheck[];
  lint?: { ok: boolean; text: string; rounds: number };   // 片段提示词写完后的校验结果与修正轮数
  plan?: Plan;
  log?: string[];
  review?: Review | null;
  actions?: MessageAction[] | null;
  followUps?: FollowUp[];
  followUpUsed?: string | null;
  followUpContext?: { chatId: string } | null;
}

export interface Chat { id: string; title: string; messages: Message[]; at: number; }

export interface Action { tool: string; args: Record<string, any>; }

export interface ModelConfig {
  provider?: 'claude' | 'openai';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  thinking?: string;
  writerModel?: string;
  writerThinking?: string;
  visionModel?: string;          // 看图用的模型（如 kimi-k3）；留空时若主模型本身支持图片输入就用主模型
  temperature?: number;          // 调用时按用途临时设置（chatCfg），不持久化
  // 图片 / 视频生成：走 Moodio 网关的 /fal 通道（见 lib/mediagen.ts），留空则沿用上面的网关地址与口令
  mediaBaseUrl?: string;
  mediaToken?: string;
  imageModel?: string;
  videoModel?: string;
  voiceModel?: string;                 // 声音模型（'auto' = 智能匹配）
  videoImageModel?: string;
  imageRatio?: string;
  videoRatio?: string;
  videoDuration?: string;        // 自定义时长（秒）
  videoResolution?: string;
  imageResolution?: string;      // 2K / 4K（方舟图片）
  durationMode?: 'smart' | 'custom';   // 智能时长 = 按提示词长度自动定
  genMode?: 'manual' | 'auto';         // 自动模式：Agent 的纯生成计划不用确认直接执行
}

export interface ProjectMeta { id: string; title: string; createdAt: number; updatedAt: number; }

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
