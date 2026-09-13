# src 目录

开发时由 `loader.js` 按 `manifest.json` 的顺序取回并拼成一段脚本执行，发布时构建成 `app.js`（共享全局作用域，函数提升跨文件有效，顺序不能改）：

- `01-data.js` 图标、初始数据、全局 state、本地存储恢复、通用工具函数
- `02-story-canvas.js` 故事结构板与灵感画布：渲染、缩放、拖拽、连线
- `03-script-render.js` 剧本块模型、剧本渲染、制作表（顺场表 / 通告单 / 日报）渲染
- `04-files-export.js` 项目备份、文件创建 / 选择 / 重命名 / 删除、视图切换、导出文档
- `05-canvas-actions.js` 画布动作、制作表交互、部分全局事件
- `06-storyboard.js` 分镜表、镜头记录、生成单元、页面板块切换
- `07-create-assets.js` 创作页生成节点与连线、资产页与资产搜索
- `08-writing-sidebar.js` 侧栏文件夹树、剧集、上下文面板、导入文档、全局搜索
- `09-cloud-doc.js` 云文档编辑器（富文本 / 媒体 / 评论）、表格、画布、思维导图
- `10-editor-interactions.js` 云文档交互、剧本撤销与格式、剧本行手柄、资产详情抽屉
- `11-agent.js` Moodio Agent 浮窗：对话、规划与确认执行、识别工作流、模型调用
- `12-effects.js` 工作区背景（已停用）、渐变光标、渐变聚焦光圈、主动提示气泡
- `styles.css` 全部样式；新增覆盖规则追加到文件末尾
