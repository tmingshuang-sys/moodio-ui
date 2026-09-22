# src 目录

- `main.tsx` 挂载；`App.tsx` 布局（侧栏 | 对话 | 分栏把手 | 工作区），全局宿主（Toast / Menu / Dialog / AgentLive）
- `lib/types.ts` 数据模型（Doc / MediaItem / Chat / Message / Plan …）
- `lib/projects.ts` 项目索引与按项目隔离的存储键
- `lib/store.ts` zustand 仓库：`useFiles`（文稿 / 媒体 / 回收站 / 纲领 / 界面偏好）、`useChats`、`useAgent`（运行态）
- `lib/storage.ts` localStorage JSON、IndexedDB blob、对象 URL 缓存、下载
- `lib/markdown.ts` 章节切分 / 按标题替换 / 追加 / 纯文本 / 文件名与类别
- `lib/guides.ts` 写作规范、剧本格式硬规则与轻量校验、分镜规范、提示词规范、纲领字段
- `lib/model.ts` 文本模型调用（Claude / OpenAI 兼容，流式）、配置存取、JSON 解析
- `lib/mediagen.ts` 图片 / 视频生成：经网关调 fal.ai 队列接口，轮询、代下载、入库；`manualGenerate()` 供输入框「+」菜单直接生成
- `lib/migrate.ts` 旧版数据迁移；`lib/sample.ts` 示例文稿；`lib/upload.ts` 上传；`lib/i18n.ts` 中 / EN；`lib/time.ts`
- `lib/agent/tools.ts` 工具层 + 计划卡步骤；`prompt.ts` 系统提示；`planner.ts` 规划 / 追问 / 下一步；`runner.ts` 回复流程、确认执行、逐行写入、自审
- `components/` Sidebar、ChatPane、MessageList、Composer、ResourcePane、Dialogs、Menu、Toast、AgentLive
- `styles.css` 全部样式
- `*.test.ts` Vitest 单元测试（与被测模块同目录）
