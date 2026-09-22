// ===== 界面语言（中 / EN）：系统文案走 t()，用户内容与模型正文不翻译 =====
import { create } from 'zustand';

const KEY = 'moodio-lang';
const EN: Record<string, string> = {
  '创作': 'Create', '资源': 'Resources', '创作纲领': 'Creative brief', '创作历史': 'History', '今天': 'Today', '昨天': 'Yesterday', '更早': 'Earlier',
  '新对话': 'New chat', '对话文件': 'Chat files', '分享': 'Share', '设置': 'Settings', '模型设置': 'Model settings', '语言': 'Language',
  '文稿': 'Documents', '图片': 'Images', '视频': 'Videos', '全部': 'All', '其他': 'Other', '人物': 'Characters', '场景': 'Locations', '道具': 'Props', '产品': 'Products',
  '查找…': 'Search…', '网格': 'Grid', '列表': 'List', '关闭工作区': 'Close workspace', '打开工作区': 'Open workspace',
  '预览': 'Preview', '编辑': 'Edit', '下载': 'Download', '重命名': 'Rename', '删除': 'Delete', '分区': 'Group', '返回': 'Back', '取消': 'Cancel', '保存': 'Save', '确定': 'OK',
  '上传图片 / 视频': 'Upload image / video', '新建文档': 'New document', '生成图片': 'Generate image', '生成视频': 'Generate video', '生成模型': 'Generation models', '视频偏好': 'Video', '图片偏好': 'Image', '模型选择': 'Model', '画面比例': 'Aspect ratio', '时长': 'Duration', '视频分辨率': 'Resolution', '图生视频': 'Image to video', '当前模型': 'Current model', '用工作区里的图片当首帧时': 'When starting from an image in the workspace', '该模型不支持在这里设置，由模型自己决定': 'This model decides it on its own', '生成按次计费，Agent 也用这里选的模型': 'Billed per run; the Agent uses these models too', '引用文件': 'Reference a file', '发送': 'Send', '停止': 'Stop',
  '与 Moodio Agent 对话，剧本、分镜、提示词都会生成到右侧工作区…': 'Chat with Moodio Agent. Scripts, storyboards and prompts land in the workspace on the right…',
  '小技巧 输入 @ 引用工作区里的文稿或图片，助手会接着上次的思路创作': 'Tip: type @ to reference a document or image; the assistant keeps your context',
  '还没有文稿。让 Agent 写剧本、拆分镜或生成提示词，产物会出现在这里。': 'No documents yet. Ask the Agent to write a script, break down shots or generate prompts.',
  '还没有图片或视频。点击输入框左下角的 + 上传，或拖拽文件到这里。': 'No images or videos yet. Use + in the composer or drag files here.',
  '没有找到匹配的文件': 'No matching files',
  '确认执行': 'Confirm', '已确认': 'Confirmed', '已取消': 'Cancelled', '待确认': 'To confirm', '完成': 'Done', '进行中': 'Running', '已停止': 'Stopped', '执行出错': 'Failed', '查看步骤': 'Show steps',
  '发送回答': 'Send answers', '由 Agent 决定': 'Let the Agent decide', '自己填写…': 'Write my own…', '已回答': 'Answered', '历史提问': 'Earlier questions',
  '你可能还想': 'You may also want to', '历史建议': 'Earlier suggestions', '已选择下一步': 'Next step chosen', '上下文已变化，请重新提问': 'Context changed, ask again',
  '思考过程': 'Thinking', '正在生成…': 'Generating…', 'Agent 正在思考…': 'Agent is thinking…', 'Agent 正在读取…': 'Agent is reading…', '正在自审刚写的内容…': 'Self-reviewing…',
  '项目': 'Project', '新建项目': 'New project', '切换项目': 'Switch project', '重命名项目': 'Rename project', '删除项目': 'Delete project',
  '很高兴见到你': 'Good to see you', '想做什么？': 'What shall we make?',
  '共': 'Total', '个': '',
};
interface LangState { lang: 'zh' | 'en'; toggle: () => void; }
export const useLang = create<LangState>(set => ({
  lang: (typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'en') ? 'en' : 'zh',
  toggle: () => set(s => { const lang = s.lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem(KEY, lang); } catch { /* ignore */ } document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'; return { lang }; }),
}));
export function t(s: string): string { return useLang.getState().lang === 'en' ? (EN[s] ?? s) : s; }
export function useT() { const lang = useLang(s => s.lang); return (s: string) => (lang === 'en' ? (EN[s] ?? s) : s); }
