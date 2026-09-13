# Moodio UI · 项目约定（给 Claude 和其他 AI 会话）

## 这是什么

Moodio 3.0 的剧本 / 分镜 / 资产创作原型，带内置 AI Agent。零依赖、无框架、无构建步骤的静态页面：
`Moodio-UI-Refined-Storyboard.html` 只保留页面结构（约 220 行），样式在 `src/styles.css`，
脚本按功能拆成 `src/01-data.js` … `src/12-effects.js` 共 12 个文件，开发时由 `src/loader.js` 按 `src/manifest.json` 的顺序取回后拼成一段脚本执行，发布时由 `scripts/build.mjs` 拼成 `dist/src/app.js`，
因此它们共享同一个全局作用域，函数提升在文件之间同样有效（后面文件定义的函数，前面的文件也能在加载期调用）。
不是 ES module，不要写 import / export；新增文件必须加进 `src/manifest.json`。每个文件的职责见 `src/README.md`。
浏览器报错时的位置显示为 `moodio-app.js`，按错误附近的 `/* ===== src/xx.js ===== */` 分隔注释找到对应文件。

目录：

- `Moodio-UI-Refined-Storyboard.html` 页面结构；`src/styles.css` 样式；`src/*.js` 脚本（见 src/README.md）
- `assets/` 图片等静态资源（样式里用 `../assets/` 引用，构建时整目录复制到 dist/assets）
- `gateway/` Cloudflare Worker 模型网关（持有模型 API key，对外 OpenAI 兼容接口）
- `site/` 页面发布配置（静态资源 Worker）
- `dist/` 发布时临时生成，已 gitignore
- `package.json` 脚本：`serve`、`gateway:deploy`、`site:deploy`

线上地址：页面 https://moodio-ui.moodio-ui.workers.dev ，网关 https://moodio-gateway.moodio-ui.workers.dev

## 运行与验证

```bash
python3 -m http.server 8765        # 本地预览，访问 http://127.0.0.1:8765/Moodio-UI-Refined-Storyboard.html
```

不要用 file:// 直接打开，浏览器会拦截模型请求。

每次改完 JS 必须做语法检查：

```bash
npm run check          # 对 src/*.js 逐个 node --check
```

改 UI 后在浏览器里实际看一眼再交付；改 Agent 逻辑后用真实模型发一条消息验证。

发布：`npm run site:deploy`（页面）、`npm run gateway:deploy`（网关）。这台电脑上访问 GitHub / Cloudflare 需要代理：
`export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890`。仓库已设置 `git config http.proxy`。

## 修改约定

- **样式**：都在 `src/styles.css`。不要改动早期规则，新的覆盖规则追加到文件末尾、带一行中文注释说明用途。品牌渐变用 `var(--brand)`；SVG 线条渐变引用 `#moodio-brand-gradient`。
- **加载期陷阱**：初始 `render()` 在 src/07 里执行，早于 08–13 的其余顶层语句；此后才初始化的 `const`/`let` 在渲染路径里用 `typeof` 探测也会抛 TDZ 错误。需要被早期渲染路径探测的模块用 `var` 声明（如 `moodioVersions`）。
- **JS**：先用 `grep -n` 在 `src/` 里定位到具体文件，再用精确字符串替换或小段插入；新增顶层函数放在相关文件里即可，不需要导出。`src/11-agent.js` 里的 `agentWindow` IIFE 内部函数在外部不可见。
- **Agent 执行前必须确认**：`reply()` 只产出计划，用户点「确认执行」后 `executePlan()` 才调用 `AGENT_TOOLS`。例外：`NO_CONFIRM_TOOLS`（read_doc / open_doc / locate_scene）直接执行，read_doc 的结果会交回模型再规划一轮。`DESTRUCTIVE_TOOLS`（delete_doc / delete_scene / delete_shot）在计划里标 ⚠，确认按钮显示删除计数；delete_doc 进 `state.trash`（7 天），结果里带「撤销删除」按钮。新增工具时同时更新：`AGENT_TOOLS`、`describeAction()`、`previewAction()`（如有内容预览）、`remotePlan()` 的系统提示，以及必要时 `NO_CONFIRM_TOOLS` / `DESTRUCTIVE_TOOLS`。
- **Agent 上下文**：`remotePlan()` 通过 `briefText()` 注入项目级创作纲领（`state.brief`，✦ 菜单里填写），通过 `agentInventoryText()` 把文档清单（含 id）、剧本场次、镜头、资产、剧集、项目塞给模型；模型只能引用清单里的 id，找不到要反问。
- **剧本上下文**：不再只给最近 40 段。`remotePlan()` 注入全部场次的一句话梗概（`sceneSummaryLines()`，缓存在 `file.sceneSummaries[场景块id]={hash,text}`，内容变了才用模型重算，`refreshSceneSummaries()` 在规划前和 Agent 执行后调用，无模型时用本地摘要）+ 与请求相关的场次全文（`relevantSceneText()`：提到的场次号、提到的人物出现的场、最后一场，最多 3 场 / 70 段）+ 请求里提到的资产卡（`mentionedAssetText()`）。另有 `read_asset` 工具供模型按需读人物卡。
- **写完自审与模型分工**：写作类工具（write_script / rewrite_scene / insert_scene）返回 `review:{fileId,sceneNo}`，`executePlan()` 执行完调用 `selfReview()` 用写作模型按当前类型的自查清单审读，结果存在消息的 `review` 字段并由 `reviewHtml()` 渲染（含「按自审建议修改这一场」按钮，action `review-fix:`）。`isCreativeRequest()` 命中的请求在 `remotePlan()` 里改用 `writerCfg()`（设置里的写作模型与写作思考模式，留空则同默认模型）。
- **格式硬规则**：`src/15-script-rules.js` 的 `MOODIO_SCRIPT_RULES`（两种排版的场景标题正则、虚写 / 不可拍 / 镜头术语词表），`formatRulesText()` 注入提示，`lintScriptBlocks()` 校验。Agent 的 write_script / rewrite_scene / insert_scene 写入前经 `lintAndFix()`：不合规就把问题清单发回模型修正，最多两轮，剩余问题写进结果。侧栏「格式检查」区（`scriptLintSection()`）对当前剧本实时校验、点击定位。词表调整只改 15 文件。
- **写作规范**：`src/14-writing-guides.js` 的 `MOODIO_WRITING_GUIDES` 按类型（series / film / short / ad / other）给出结构、格式、对白与节奏、自查清单，`writingGuideText()` 只注入当前纲领类型那一份。多场内容分两轮：先大纲后逐场。
- **追问协议**：系统提示里的「意图澄清协议」要求创意类请求信息不足时先用 `ask_user`（最多 3 问、给选项）；`reply()` 遇到 ask_user 只渲染问题卡片（`questionsHtml()`，消息字段 `questions` / `answers` / `questionsUsed`），不执行其他动作；用户点选后自动发送回答。用户给出的纲领信息由 `save_brief` 记录。
- **下拉菜单动效**：由 JS 开合的菜单（剧集 / 剧本格式 / 资产切换 / 文件右键 / 云文档块菜单）统一走 `moodioMenuFx`（src/00-menu-motion.js）：先摆位、移除 hidden，再 `open(menu)`；关闭用 `close(menu, () => menu.classList.add('hidden'))`，判断是否打开用 `isOpen(menu)`（收起中途视为已关闭）。随 render 重建的菜单（标签、媒体、画布操作、云文档小弹层）只用 styles.css 末尾的关键帧入场。新增下拉菜单沿用同一套。
- **不显示模拟鼠标**：显式化操作只用元素高亮与逐行写入。执行期间（`executePlan()`、`executeWorkflow()`、`reply()` 里免确认工具的自动执行）通过 `agentGlow(true/false)` 在工作区表面盖一层淡蓝紫流光 `#agent-glow`（z-index 460，在 Agent 面板之下，不可点击），同时 `agentExecMode()` 收起对话面板、把状态胶囊 `#agent-live` 变成吉祥物旁的气泡（`.as-bubble`，`positionLiveBubble()` 按 `#agent-fab` 定位、带小三角）；`agentEnd()` 关掉流光、气泡复原，面板若执行前是开着的就重新打开。
- **模型调用**只经过 `callOpenAI()` / `callClaude()`；两者都支持 `{signal,onText,onReasoning}` 流式回调。OpenAI 兼容通道按 `cfg.thinking` 发送 DeepSeek 的 `thinking` / `reasoning_effort`。
- **密钥**：任何 API key 不得进入仓库、备份文件或对话；页面里的 key 只存 localStorage `moodio-agent-model`（备份时跳过）。
- **数据**：多项目。索引在 localStorage `moodio-projects-v1`；每个项目的工作区在 `moodio-ui-refined-storyboard-v1::<项目id>`，对话在 `moodio-agent-chats::<项目id>`（键由 `moodioProjects.key()` 生成，见 src/00-projects.js）；媒体在 IndexedDB `moodio-cdoc-media`（全局）；文档快照在 IndexedDB `moodio-versions`（按项目和文档索引，见 src/13-versions.js：每 2 分钟自动、Agent 执行前后、恢复前，内容相同不重复，每文档最多 100 条，自动快照 30 天后清理；只作安全网，UI 不展示）。**文档版本**：每类文档（空白页面按 lineageId）最新一份可编辑、自动保存，旧版本只读（稿纸顶部只读栏，可「恢复为最新版本」= 用旧版内容覆盖最新版）；新建版本只由用户点「新建版本」或明确要求 Agent（create_version）。`persistWorkspace()` 是唯一的保存入口。切换 / 新建项目会整页重新加载；新建的项目通过 `moodio-project-fresh::<id>` 标记在首次加载时重置为空白（逻辑在 src/08 的 episodes 闭包末尾）。
- **提交**：改动完成并验证后立即 commit 并 push，提交信息用中文，末尾加 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`。
- **不要编辑** `~/Downloads` 里的旧副本；不要把 `dist/`、`node_modules/`、`.wrangler/` 提交进仓库。

## 代码地标（在 src/ 里 grep 函数名）

| 功能 | 入口 |
|---|---|
| 全局重绘 | `function render()` |
| 保存 / 新建剧集 | `persistWorkspace()`、`freshWorkspace()` |
| 封面页 | `renderCover()`（空白封面用 `file.blank` 与 `data-placeholder`） |
| 资产侧栏 | `.project-rail`，`alignAssetsRail()` 已改为固定内边距 |
| Agent 面板 | `(function agentWindow(){ ... })()` |
| 聊天规划 | `remotePlan()`（模型）、`localPlan()`（本地回退）、`partialPlanMessage()`（流式取 message） |
| 执行工具 | `AGENT_TOOLS`：追问 ask_user / save_brief；读取 read_asset / read_doc / open_doc / locate_scene；文档 create_doc / rename_doc / duplicate_doc / delete_doc；剧本 write_cover / write_script / rewrite_scene / insert_scene / delete_scene / move_scene；镜头 create_shots / update_shot / delete_shot / move_shot / create_chunk；资产 create_asset / update_asset / merge_assets / delete_asset；剧集 create_episode / switch_episode / rename_episode（通过 `episodesApi`，定义在 src/08）；项目 create_project / switch_project / rename_project（`moodioProjects`）；版本 list_versions / restore_version / create_version（文档版本链，见 src/08）；导出 export_docs / export_backup |
| 文档版本 | 侧栏文件夹展开区（src/08 `renderWritingFolders()`）：`docVersionsOf()` / `latestVersionOf()` / `isHistoricalFile()`；恢复 `restoreVersionToLatest()`（入口 `data-version-restore-file`，确认弹窗 `data-version-restore-confirm`）；新建 `createVersionFromCurrent()`；历史稿纸只读由 `applyHistoricalReadonly()` 包在 render 上 |
| 内容快照（安全网） | `moodioVersions`（src/13）：`snapshot()` / `snapshotAll()` / `restore()` / `restoreFromFile()`，只给 Agent 执行前后与恢复前留底，不在侧栏展示 |
| 回收站 | `state.trash`，文档用 `trashPut()`、资产用 `trashPutAsset()`，`trashRestore()` 统一恢复；入口是消息里的 `restore-trash:` 按钮 |
| 识别分镜 / 资产工作流 | `agentWorkflowClient`、`analyzeWorkflow()`、`executeWorkflow()` |
| 模型设置对话框 | `[data-agent-model-settings]` 处理器，`PROVIDER_DEFAULTS` |
| 吉祥物气泡 | `agentHintController`（约 10 秒一轮） |
| 渐变聚焦光圈 / 渐变光标 | `#gradient-focus-ring`、`#gradient-caret` 两个 IIFE |
| 项目备份 | `buildProjectBackup()`、`applyProjectBackup()`，入口在导出窗口底部 |
| 导出文档 | `openExportDialog()`；Word `downloadDocuments()`、PDF `exportPdfDocuments()`（把 `exportPaperMarkup()` 的稿纸放进 `.pdf-export-stage` 离屏渲染，与页面同一套样式；按叶子块分页不切行，html2canvas 逐页栅格化写入 jsPDF A4；两个库只在首次导出 PDF 时从 cdnjs 加载，是零依赖原则的唯一例外）、文本 `downloadTextDocuments()` |
| 通用对话框 | `openFlowDialog()` / `closeFlowDialog()` / `flowButton()`。**弹窗规范**（以「导入文档到哪个板块」为准）：宽 620、圆角 12、标题栏 18/22 + 右上 ×、正文 20/22、两列卡片只显示名称（不放名称下的说明文字）、底栏 14/22 按钮靠右；非 flow 的弹窗（导出窗口）用样式对齐到同样尺寸 |

## 已知限制

- 单文件、全局 state、整体 innerHTML 重绘；流式回复靠 `renderAgentSoon()` 按帧合并。
- textarea（Agent 输入框、分镜描述）无法使用渐变光标，只有 contenteditable 区域可以。
- 数据只在浏览器本地，多端同步和登录尚未实现；下一阶段计划见 README。
