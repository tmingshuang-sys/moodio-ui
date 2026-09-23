// ===== 界面语言（中 / EN）：系统文案走 t()，用户内容与模型正文不翻译 =====
import { create } from 'zustand';

const KEY = 'moodio-lang';
const EN: Record<string, string> = {
  '创作': 'Create', '资源': 'Resources', '创作纲领': 'Creative brief', '创作历史': 'History', '今天': 'Today', '昨天': 'Yesterday', '更早': 'Earlier',
  '新对话': 'New chat', '对话文件': 'Chat files', '分享': 'Share', '设置': 'Settings', '模型设置': 'Model settings', '语言': 'Language',
  '文稿': 'Documents', '图片': 'Images', '视频': 'Videos', '全部': 'All', '其他': 'Other', '人物': 'Characters', '场景': 'Locations', '道具': 'Props', '产品': 'Products',
  '查找…': 'Search…', '网格': 'Grid', '列表': 'List', '关闭工作区': 'Close workspace', '打开工作区': 'Open workspace',
  '预览': 'Preview', '编辑': 'Edit', '下载': 'Download', '重命名': 'Rename', '删除': 'Delete', '分区': 'Group', '返回': 'Back', '取消': 'Cancel', '保存': 'Save', '确定': 'OK',
   '新建文档': 'New document', '生成图片': 'Generate image', '生成视频': 'Generate video', '生成模型': 'Generation models', '视频模型': 'Video model', '图片模型': 'Image model', '模型选择': 'Model', '画面比例': 'Aspect ratio', '时长': 'Duration', '视频分辨率': 'Video resolution', '图片分辨率': 'Image resolution', '智能时长': 'Smart', '自定义时长': 'Custom', '生成模式': 'Generation mode', '手动模式': 'Manual', '自动模式': 'Auto', '秒': 's', '图生视频': 'Image to video', '用工作区里的图片当首帧时': 'When starting from an image in the workspace',  '引用文件': 'Reference a file', '发送': 'Send', '停止': 'Stop',
  '小技巧': 'Tip',
  '输入 @ 引用工作区里的文稿或图片，Agent 会接着上次的思路创作': 'Type @ to reference a document or image; the Agent keeps your context',
  '选一个类型、回答几道题，其余交给 Agent；不想选就用推荐值': 'Pick a format, answer a few questions and leave the rest to the Agent; recommended answers are preselected',
  '打开「一键模式」，Agent 会自动走完脚本、参考图和片段方案，只在检查点等你确认': 'Turn on one-click mode and the Agent runs script, references and clip plan by itself, pausing only at checkpoints',
  '把产品实拍图或人物照片拖进工作区，参考图就会以它为准': 'Drop a product photo or a portrait into the workspace and references will follow it',
  '做 MV 时上传歌曲文件，成片会用整首歌铺满并烧上歌词字幕': 'For an MV, upload the song; the final cut uses the full track and burns in the lyrics',
  '输入框下方的「模型」按钮可以切换视频、图片、声音和推理模型，默认智能匹配': 'The model button under the composer switches video, image, voice and reasoning models; smart matching is the default',
  '生成过程中关掉页面也没关系，回来会接着轮询并把结果入库': 'You can close the page while generating; it resumes polling and stores the result when you return',
  '点对话上方的阶段条查看台账：每一步的答案、实体、参考图和片段': 'Click the stage strip above the chat to open the ledger: answers, entities, references and clips',
  '对结果不满意直接说：「重新生成第 2 张参考图」「第 3 段改成夜景」': 'Not happy with a result? Just say "regenerate reference 2" or "make clip 3 a night scene"',
  '有对白的角色会先设计音色样本，旁白会自动合成配音': 'Speaking characters get a designed voice sample first; narration is synthesised automatically',
  '写好的文稿在「对话文件」里可以直接编辑，Agent 下一轮就能看到你的修改': 'Documents in the file pane can be edited directly; the Agent sees your changes next turn',
  '还没有文稿。让 Agent 写剧本、拆分镜或生成提示词，产物会出现在这里。': 'No documents yet. Ask the Agent to write a script, break down shots or generate prompts.',
  '还没有图片或视频。点击输入框左下角的 + 上传，或拖拽文件到这里。': 'No images or videos yet. Use + in the composer or drag files here.',
  '没有找到匹配的文件': 'No matching files',
  '确认执行': 'Confirm', '已确认': 'Confirmed', '已取消': 'Cancelled', '待确认': 'To confirm', '完成': 'Done', '进行中': 'Running', '已停止': 'Stopped', '执行出错': 'Failed', '查看步骤': 'Show steps',
  '发送回答': 'Send answers', '由 Agent 决定': 'Let the Agent decide', '自己填写…': 'Write my own…', '已回答': 'Answered', '历史提问': 'Earlier questions',
  '你可能还想': 'You may also want to', '历史建议': 'Earlier suggestions', '已选择下一步': 'Next step chosen', '上下文已变化，请重新提问': 'Context changed, ask again',
  '思考过程': 'Thinking', '正在生成…': 'Generating…', 'Agent 正在思考…': 'Agent is thinking…', 'Agent 正在读取…': 'Agent is reading…', '正在自审刚写的内容…': 'Self-reviewing…',
  '项目': 'Project', '新建项目': 'New project', '切换项目': 'Switch project', '重命名项目': 'Rename project', '删除项目': 'Delete project',
  '素材库': 'Library', '资产库': 'Assets', '搜索素材': 'Search media', '平铺视图': 'Grid view', '列表视图': 'List view', 'AI 生成': 'AI generated', '我上传的': 'Uploaded by me', '筛选': 'Filter', '排序': 'Sort', '展示尺寸': 'Card size', '最新在前': 'Newest first', '最早在前': 'Oldest first', '按名称': 'By name', '小': 'Small', '中': 'Medium', '大': 'Large', '打开所在创作': 'Open in its creation', '关闭': 'Close', '删除文件': 'Delete file',
  '已提交': 'Submitted', '已选择': 'Selected', '上一题': 'Previous', '下一题': 'Next', '补充说明…': 'Add details…', '查看文件': 'Open file', '再试一次': 'Try again',
  '推理模型': 'Chat model', '智能匹配模型': 'Smart match', '规划': 'planning', '写作': 'writing', '看图': 'vision', '不可用时自动换': 'falls back automatically', '能看图': 'vision', '思考模式': 'Thinking', '跟随默认': 'Default', '低': 'Low', '高': 'High', '最高': 'Max', '当前直连 Claude，推理模型在模型设置里填写。': 'Connected directly to Claude; set the chat model in Model settings.',
  '取消任务': 'Cancel task', '后台任务（点击可取消）': 'Background tasks (click to cancel)', '生成中': 'Generating',
  '音频': 'Audio', '上传图片 / 视频 / 音频': 'Upload image / video / audio', '配乐': 'Music',
  '当前阶段': 'Current stage', '更新于': 'Updated', '本阶段': 'This stage', '目标': 'Goal: ', '产物': 'Outputs: ', '进入下一阶段的条件': 'Gate: ', '已确认的信息': 'Confirmed info', '实体与参考图': 'Entities & references', '音色': 'Voice', '声音模型': 'Voice models', '跳过音色': 'Skip voices', '返回主页': 'Home', '去剪映编辑': 'Open in CapCut', '把片段按顺序写成剪映草稿并打开剪映': 'Write the clips as a CapCut draft and open CapCut', '选择文件夹': 'Choose folder', '导出片段': 'Export clips', '导出片段到剪辑软件': 'Export clips to an editor', '会把成片的每个片段按顺序导出成 clip_01、clip_02…，并附一份达芬奇 / Final Cut 能直接导入的工程文件，导入后时间线上已经排好。': 'Each clip is exported in order as clip_01, clip_02…, together with a project file DaVinci Resolve or Final Cut can import directly, with the timeline already laid out.', '第一次需要选一个存放片段的文件夹（建议「影片」），之后不用再选。': 'The first time, pick a folder to hold the clips (Movies works well); it will be remembered.', '片段存到哪': 'Where to put the clips', '只需这一次，之后直接导出。': 'Only needed this once; later exports go straight through.', '把文件夹从访达拖到这里': 'Drag a folder here from Finder', '一步搞定：同时拿到存放位置和路径，不用手填': 'One step: this gives both the location and its path, nothing to type', '或者点这里选文件夹': 'Or pick a folder here', '路径': 'Path', '路径要以 / 开头，这次先只导片段': 'The path must start with /; exporting clips only this time', '查看创作进度': 'Open the ledger', '收起步骤': 'Collapse steps', '一键模式已暂停：上一步没有推进。点当前步骤重试，或告诉 Agent 怎么改。': 'One-click mode paused: the last step did not move forward. Click the current step to retry, or tell the Agent what to change.', '展开步骤': 'Expand steps', '没有歌曲，先跳过': 'No song yet, skip', '片段': 'Clips', '镜头': 'shots', '备注': 'Notes',
  '下一步': 'Next step', '现在': 'Now', '还剩': 'left', '步': 'steps', '让 Agent 修改': 'Ask the Agent to change', '跳过参考图': 'Skip references', '跳过校验继续': 'Skip checks and continue', '执行中，点击停止': 'Running, click to stop', '一键模式': 'One-click mode', '开着时，除删除和四个检查点外的步骤都自动执行': 'When on, every step except deletions and the four checkpoints runs automatically', '重试这一步': 'Retry this step', '推荐': 'recommended', '让 Agent 再修': 'Ask the Agent to fix again', '选一个类型，回答几道题，剩下的交给 Agent；也可以直接在下面说。': 'Pick a type, answer a few questions and let the Agent do the rest, or just type below.',
  '新创作': 'New creation', '删除创作': 'Delete creation', '删除对话': 'Delete chat',
  '很高兴见到你': 'Good to see you',
  '共': 'Total', '个': '',
};
interface LangState { lang: 'zh' | 'en'; toggle: () => void; }
export const useLang = create<LangState>(set => ({
  lang: (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'en') ? 'en' : 'zh',
  toggle: () => set(s => { const lang = s.lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem(KEY, lang); } catch { /* ignore */ } document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; return { lang }; }),
}));
export function t(s: string): string { return useLang.getState().lang === 'en' ? (EN[s] ?? s) : s; }
export function useT() { const lang = useLang(s => s.lang); return (s: string) => (lang === 'en' ? (EN[s] ?? s) : s); }
