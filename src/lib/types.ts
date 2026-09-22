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

export type MediaKind = 'image' | 'video';

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
}

export interface TrashEntry { trashId: string; deletedAt: number; doc?: Doc; media?: MediaItem; }

export interface Brief {
  format?: string; duration?: string; platform?: string; audience?: string; tone?: string;
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
export interface FollowUp { label: string; prompt: string; }
export interface Question { text: string; options: string[]; multi: boolean; }
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';
export interface PlanStep { tool: string; kind: string; title: string; preview: string; destructive: boolean; status: StepStatus; result: string; logs: string[]; }
export type PlanState = 'pending' | 'confirmed' | 'cancelled' | 'running' | 'reviewing' | 'done' | 'stopped' | 'error';
export interface Plan { key?: string; steps: PlanStep[]; state: PlanState; destructive?: number; }
export interface ReviewIssue { point: string; fix: string; }
export interface ReviewItem { docId: string; title: string; verdict: '通过' | '需修改'; score: number | null; praise: string; issues: ReviewIssue[]; }
export interface Review { items: ReviewItem[]; at: number; }
export interface MessageAction { id: string; label: string; }

export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  thinking?: string;
  streaming?: boolean;
  quote?: { text: string; source?: string } | null;
  attachments?: string[];              // 引用的媒体 id
  questions?: Question[];
  answers?: Record<number, number[]>;
  questionsUsed?: boolean;
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
  // 图片 / 视频生成：走 Moodio 网关的 /fal 通道（见 lib/mediagen.ts），留空则沿用上面的网关地址与口令
  mediaBaseUrl?: string;
  mediaToken?: string;
  imageModel?: string;
  videoModel?: string;
  videoImageModel?: string;
}

export interface ProjectMeta { id: string; title: string; createdAt: number; updatedAt: number; }

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
