# Moodio UI · 项目约定（给 Claude 和其他 AI 会话）

## 这是什么

Moodio 的「对话 + 文件工作区」创作原型（参考小云雀的布局）：左侧导航（创作 / 资源 / 创作纲领 / 创作历史）、中间与 Agent 对话、右侧是文件工作区。
所有产物都是文件：剧本、分镜表、视频生成提示词、人物小传、营销文案等是 Markdown 文稿（.md，也支持 .json / .txt），图片和视频在媒体区单独分区。旧版的剧本稿纸、资产板块、创作画布已整体去掉（保留在分支 `main` / `split-workspace`）。

技术栈：**Vite + React 19 + TypeScript**，状态用 zustand，Markdown 渲染用 react-markdown + remark-gfm，媒体 blob 用 idb-keyval 存 IndexedDB，图标用 lucide-react。没有后端：数据只在浏览器本地（localStorage + IndexedDB）。

目录：

- `index.html` 入口；`src/main.tsx` 挂载；`src/App.tsx` 布局（侧栏 | 对话 | 可拖拽分栏的工作区）
- `src/lib/` 逻辑层：`types.ts` 数据模型；`projects.ts` 项目层（索引 `moodio-projects-v1`，数据键 = 基础键 `::` 项目id）；`store.ts` 状态仓库（`useFiles` 文稿 / 媒体 / 回收站 / 纲领 / 界面偏好，`useChats` 对话，`useAgent` 运行态）；`storage.ts` localStorage / IndexedDB / 下载；`markdown.ts` 章节切分、按标题替换、纯文本、文件名；`guides.ts` 写作规范 / 剧本格式硬规则 / 分镜规范 / 提示词规范；`model.ts` 文本模型调用（Claude 直连 / OpenAI 兼容，流式）；`mediagen.ts` 图片 / 视频生成（经网关调 fal.ai）；`migrate.ts` 旧版数据迁移；`sample.ts` 新项目示例文稿；`upload.ts` 上传；`i18n.ts` 中 / EN；`time.ts`
- `src/lib/agent/`：`tools.ts` 工具层与计划卡步骤；`prompt.ts` 系统提示（MD 约定、文件清单、相关文稿上下文）；`planner.ts` 模型规划、追问、下一步建议；`runner.ts` 回复流程、确认执行、逐步状态、逐行写入、自审
- `src/components/`：`Sidebar` `ChatPane` `MessageList`（消息、计划卡、追问卡、自审卡、下一步）`Composer` `ResourcePane`（分区网格 / 列表、文稿预览与编辑、媒体预览、拖拽上传）`Dialogs`（确认 / 输入 / 模型设置 / 创作纲领）`Menu` `Toast` `AgentLive`（流光与状态胶囊）
- `src/styles.css` 全部样式；`public/moodio-logo.svg` logo（矢量、透明底，侧栏与页面图标共用）；`*.test.ts` 与源码同目录（Vitest）
- `gateway/` Cloudflare Worker 模型网关（持有真实 API key）：文本走 OpenAI 兼容的 `/v1/chat/completions`，图片 / 视频走 `/fal/*` 透传到 fal.ai 队列接口、`/media?url=` 代下载结果；`site/` 页面发布配置（静态资源 Worker，目录 `dist`）
- `dist/` 构建产物，已 gitignore；`scripts/postbuild.mjs` 构建后把 index.html 复制一份为旧链接的文件名

线上地址：页面 https://moodio-ui.moodio-ui.workers.dev ，网关 https://moodio-gateway.moodio-ui.workers.dev

## 运行与验证

```bash
npm run dev            # Vite 开发服务器 http://localhost:5174（.claude/launch.json 的 moodio-ui 配置）
npm run check          # tsc --noEmit
npm test               # vitest run
npm run build          # vite build → dist/
```

每次改完代码：`npm run check` 和 `npm test` 必须通过；改 UI 后在浏览器里实际看一眼再交付；改 Agent 逻辑后用真实模型发一条消息验证。

发布：`npm run site:deploy`（页面）、`npm run gateway:deploy`（网关）。这台电脑上访问 GitHub / Cloudflare / npm 需要代理：
`export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890`。仓库已设置 `git config http.proxy`。

## 修改约定

- **状态**：只通过 zustand 仓库改数据（`useFiles` / `useChats` / `useAgent`），仓库自己负责持久化（文件 `moodio-files-v1::<项目id>`，对话 `moodio-agent-chats::<项目id>`，媒体 blob IndexedDB `moodio-media`；键在保存时按当前项目动态取，`reload()` 可整体换成另一个项目的数据）。组件里用 hook 选择需要的字段；逻辑层用 `useX.getState()`。流式更新对话用 `useChats.getState().mutate(fn)` 原地改后提交；`mutate` 会给每个对话换新的对象引用（消息对象不换），因为 `ChatPane` 按对话对象订阅，只换外层数组不会重渲染。新加按对象订阅的组件时记住这一点，不要在 store 里只做 `slice()`。
- **Agent 执行前必须确认**：`reply()`（runner.ts）只产出计划，用户点「确认执行」后 `executePlan()` 才调用 `AGENT_TOOLS`。例外：`NO_CONFIRM_TOOLS`（read_doc / open_doc / open_media / export_doc / save_brief）直接执行，read_doc 的结果交回模型再规划一轮（最多四轮）。`DESTRUCTIVE_TOOLS`（delete_doc / delete_media）在计划卡里标「删除」，确认按钮显示删除计数；删除进回收站 7 天，结果里带「撤销删除」。新增工具时同时更新：`AGENT_TOOLS`、`describeAction()`、`previewAction()`、`PLAN_KIND`、`buildSystemPrompt()` 里的工具说明，必要时 `NO_CONFIRM_TOOLS` / `DESTRUCTIVE_TOOLS`。
- **写入文稿的显式化**：写作类工具（write_doc / append_doc / replace_section）不直接改内容，而是调 `ctx.typeInto(docId, from, to)`：在右侧工作区打开该文稿、逐行显示变化的部分（`useAgent.writing`），完成后再提交；期间工作区盖流光（`AgentLive`）、状态胶囊显示「写入第 k/n 行」、左侧计划卡逐步更新。
- **文稿约定**（模型与工具都遵守，见 prompt.ts）：剧本每场一个 `## INT./EXT. 地点 - 时间`，对白 `**人物**` 独占一行；分镜表是固定列的 Markdown 表格；提示词一镜一份 `视频生成Prompt-01.md`；人物在 `人物小传.md` 每人一个二级标题。改已有文稿优先 `replace_section` / `append_doc`，整份重写才 `write_doc` + `overwrite`。`docRole(name)` 按文件名判断类别，剧本类写完会用写作模型自审（`selfReview`），结果渲染成自审卡。
- **上下文注入**：`buildSystemPrompt()` 注入文件清单（含 id）、`relevantDocs()`（打开中的文稿、请求里提到的文件名、按请求类型自动补的剧本 / 分镜 / 人物文稿，总量约 16k 字）、创作纲领、当前类型的写作规范；提到分镜 / 提示词 / 剧本时分别加分镜规范 / 提示词规范 / 格式硬规则。模型只能引用清单里的 id，找不到要反问。
- **追问协议**：系统提示里的「意图澄清协议」要求创意类请求信息不足时先用 `ask_user`（最多 3 问、给选项）；`reply()` 遇到 ask_user 只渲染追问卡（消息字段 `questions` / `answers` / `questionsUsed`），点选答案只改选中态，点「发送回答」才提交。纲领信息由 `save_brief` 记录。
- **图片 / 视频生成**：只经过 `mediagen.ts`，按模型的 `provider` 分流。fal：POST `/fal/<模型id>` 提交 → 轮询 `status_url` / `response_url`（都改写成走网关）→ `/media?url=` 代下载；停止或出错 PUT `cancel_url` 取消。方舟：视频用 `/ark/contents/generations/tasks` 建任务再轮询（停止时 DELETE 任务），文生图用 `/ark/images/generations` 一次同步调用。两家的结果都经 `/media?url=` 下载进媒体库。真实 key 是网关的 Worker secret `FAL_KEY` / `ARK_API_KEY`，页面只带访问口令（同对话用的那个）。Agent 工具 `generate_image` / `generate_video` 与输入框「+」菜单的手动生成共用这一层；生成按次计费，所以不放进 `NO_CONFIRM_TOOLS`。方舟模型要在控制台单独开通，未开通时 `arkFetch()` 把 `ModelNotOpen` 翻成人话提示。
- **模型目录与两家上游**：`mediamodels.ts` 列出图片 / 文生视频 / 图生视频三组预设，每条带 `provider`（`fal` 或 `ark`）并声明它接受哪些可选参数，因为各家入参不一样：fal 有的收 `image_size`（`landscape_16_9` 枚举）、有的收 `aspect_ratio`（`"16:9"`）、有的只收 prompt，发多余字段会被 422 退回；火山方舟把画幅 / 时长 / 分辨率以 `--ratio --duration --resolution` 拼在提示词后面（`arkPromptArgs()`），文生图则用像素尺寸（`arkImageSize()`，Seedream 5 要求不少于 3686400 像素）。界面上画面比例统一写 `16:9`，由 `ratioValue()` 转成各家要的值。
  加模型：方舟用 `GET /ark/models` 能列出账号下全部型号，最准；fal 的 id 从官网抄。**注意 fal 队列接口只在顶层命名空间不存在时才 404**，所以「提交返回 200」不能证明具体变体存在，要看任务状态或实际跑一次才算数；空请求体也会被排进队列而不是被拒绝。
  用户在输入框下方的「模型」按钮（`ModelPrefs.tsx`）里选，选择存 `moodio-agent-model` 的 `imageModel` / `videoModel` / `videoImageModel`（默认 `'auto'` = 「智能匹配模型」：`AUTO_CHAINS` 里的候选链依次尝试，图片 Seedream 5.0 → 5.0 Flash → 4.5 → Seedream 3.0（fal）→ FLUX.1 dev，视频 Seedance 2.5 → 2.0 → 2.0 Fast → 1.0 Pro → 可灵 1.0；只有 `unavailableReason()` 认定的「模型不可用」错误（方舟 ModelNotOpen / AccountOverdueError / 模型不存在、HTTP 401 / 403 / 404 / 503）才换下一个，生成本身失败或参数错误原样抛出，不悄悄换模型；`generateImage()` / `generateVideo()` 返回 `GenResult {item, model, skipped}`，结果文案用 `fallbackNote()` 写明换了哪个；面板里智能匹配按候选链第一个模型的能力显示选项 `effectivePreset()`；状态气泡文案带当前模型名与跳过原因（`labelled()` / `skipNote()`），生成出的 `MediaItem.model` 记录实际模型名并在媒体详情顶栏显示；旧配置里的具体模型 id 在首次带此版本启动时一次性改成 `'auto'`，标记 localStorage `moodio-model-prefs-v2`）/  `imageRatio` / `imageResolution`（2K / 4K，只有方舟 Seedream 支持；fal 的 FLUX 会把超过 2048 的尺寸裁掉还改比例，所以 fal 图片模型不开放分辨率）/ `videoRatio` / `videoResolution` / `durationMode`（`smart` 默认：`smartDuration()` 按提示词长度估秒数，再由 `clampDuration()` 收敛到模型的固定档位 `durations` 或范围 `durationRange`；`custom`：1–30 秒滑杆，fal 可灵只有 5 / 10 两档）/ `genMode`（`manual` 默认；`auto` 时 `reply()` 里只含 `GENERATE_TOOLS` 与免确认工具的计划不出确认按钮、回复落地后直接 `executePlan()`）。
- **模型调用**只经过 `model.ts` 的 `callModel()`（内部按 provider 走 `callClaude` / `callOpenAI`），支持 `{signal,onText,onReasoning}`。密钥只存 localStorage `moodio-agent-model`，任何 API key 不得进入仓库或对话。创意类请求（`isCreativeRequest`）用写作模型 `writerCfg()`。
- **样式**：都在 `src/styles.css`，按区块分段；颜色用 `:root` 里的变量，新规则追加到对应区块或文件末尾并加中文注释。**配色是黑白灰**：主色 `--accent` 就是墨色，选中态用 `--accent-soft` 浅灰底 + 墨色字，不要引入紫色或蓝色做强调；彩色只留状态语义（成功绿 `#2f6b45`、警告 `--warn`、危险 `--danger`）。品牌渐变 `--brand` 只给 logo 等品牌位，不要用在按钮、徽标、进度条上。弹窗规范：宽 620、圆角 12、标题栏 18/22 + 右上 ×、正文 20/22、底栏按钮靠右。
- **界面语言**：系统文案用 `useT()` / `t()`（i18n.ts 的 `EN` 词典），用户内容与模型正文不翻译。新增系统文案时在词典里补一条。
- **创作 = 项目**（`session.ts`）：侧栏「创作」按钮调 `startCreation()`：新建一个空白项目并**热切换**过去（`flushStores()` 先把挂起的保存写进旧项目，再 `projects.create(...,{reload:false})` + 两个仓库 `reload()`，不刷新页面），新项目没有示例文稿、工作区默认收起（`ui.paneOpen=false`，有产物时 `openInPane()` 自动打开）、标题先叫「新创作」，第一句话发出后 `push()` 把项目名改成对话标题。当前创作还是空白时再点「创作」只聚焦输入框。「创作历史」= 当前项目的对话（内存）+ 其他项目里有内容的对话（`otherProjectsHistory()` 读 localStorage，只在项目变动时重算），点一条 `switchProject(项目id, 对话id)`；条目菜单里「重命名」同步项目名，「删除」在项目只有这一条对话时是删整个创作（`deleteCreation()`：连文件一起删，删当前项目就切到最近改动的另一个，只剩一个时清空成新创作），否则只删对话。Agent 执行中（`useAgent.busy`）拒绝切换。Agent 工具 `create_project` / `switch_project` 仍走整页刷新（它们在计划执行中途调用，热切换会让执行器丢失消息引用）。
- **旧数据**：首次用新版打开某个项目时 `migrate.ts` 把旧版 `moodio-ui-refined-storyboard-v1::<项目id>` 转成文稿与媒体（旧键保留不删）；没有旧数据的全新项目给 `sample.ts` 的示例文稿；`projects.create()` 建的项目都带 `moodio-project-fresh::<id>` 标记，首次加载为空白且工作区收起。
- **提交**：改动完成并验证后立即 commit 并 push，提交信息用中文，末尾加 `Co-Authored-By: Claude <当前模型名> <noreply@anthropic.com>`。
- **不要提交** `dist/`、`node_modules/`、`.wrangler/`；不要编辑 `~/Downloads` 里的旧副本。

## 代码地标

| 功能 | 入口 |
|---|---|
| 布局 / 分栏拖拽 | `App.tsx`（`ui.paneWidth`，最小对话 380 / 工作区 420）；工作区关掉后右缘把手 `PaneHandle` |
| 发送 / 回复 / 确认执行 | `runner.ts`：`send()` → `reply()`；`executePlan()` / `cancelPlan()`；`runActions()` 逐步标状态；`stopAgent()` |
| 工具 | `tools.ts`：`AGENT_TOOLS`（save_brief / ask_user / read_doc / open_doc / open_media / export_doc / write_doc / append_doc / replace_section / rename_doc / delete_doc / rename_media / tag_media / delete_media / generate_image / generate_video / create_project / switch_project / rename_project）、`planSteps()` |
| 图片 / 视频生成 | `mediagen.ts`：`generateImage()` / `generateVideo()` / `manualGenerate()`（手动入口）/ `buildInput()` / `mediaEndpoint()` / `mediaReadyReason()` / `MEDIA_DEFAULTS`；网关侧见 `gateway/worker.js` 的 `falProxy` 与 `mediaProxy` |
| 模型选择面板 | `ModelPrefs.tsx`（输入框工具栏里的按钮，视频 / 图片两个标签页 + 画面比例 + 时长）；模型目录 `mediamodels.ts` |
| 计划卡 / 追问卡 / 自审卡 / 下一步 | `MessageList.tsx`（`PlanCard` / `QuestionCard` / `ReviewCard`），动作 id：`plan-confirm:` `plan-cancel:` `open-doc:` `open-media:` `restore-trash:` |
| 工作区 | `ResourcePane.tsx`：分区网格 / 列表与搜索、`DocView`（预览 / 编辑自动保存、Agent 写入实时显示）、`MediaView`、拖拽上传；上传逻辑 `upload.ts` |
| 侧栏 | `Sidebar.tsx`：项目菜单（切换 / 新建 / 重命名 / 删除）、创作历史（跨项目，按今天 / 昨天 / 更早分组）、底部设置菜单（模型设置 / 语言）；创作会话逻辑在 `session.ts`（`startCreation` / `switchProject` / `deleteCreation` / `otherProjectsHistory`） |
| 弹窗 | `Dialogs.tsx`：`confirmDialog()` / `promptDialog()` / `openModelSettings()` / `openBrief()` |
| 模型 | `model.ts`：`modelCfg()` / `saveModelCfg()` / `PROVIDER_DEFAULTS` / `probeModel()` / `parsePlanJSON()` / `partialPlanMessage()` |

## 已知限制

- 数据只在浏览器本地，多端同步和登录尚未实现；分享按钮是占位。
- 视频生成按次计费且要等几分钟，没有做排队列表或后台任务，关掉页面任务就断了（fal 那边仍会跑完，但结果不会自动入库）。
- 语音输入未做。
- 剧本格式校验只做轻量提示（`lintScriptMarkdown`），不再退回模型自动修正。
