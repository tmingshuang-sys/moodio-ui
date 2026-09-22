# Moodio UI · 对话 + 文件工作区

创作原型：左侧导航，中间与 Moodio Agent 对话，右侧是文件工作区。剧本、分镜表、视频生成提示词、人物小传都是 Markdown 文稿，图片和视频单独分区；Agent 写作时会在右侧逐行写入。

技术栈：Vite + React + TypeScript（zustand / react-markdown / idb-keyval / lucide-react）。配套：`gateway/` 模型网关（Cloudflare Worker），`site/` 页面发布配置。线上地址 https://moodio-ui.moodio-ui.workers.dev

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5174
npm run check      # 类型检查
npm test           # 单元测试
npm run build      # 构建到 dist/
```

## 模型配置

侧栏底部用户菜单里的「模型设置」（或对话右上角的设置图标）：填写服务商、Base URL、API Key（用 Moodio 网关时填访问口令）、模型名和思考模式。密钥只保存在本机浏览器。

同一个弹窗下半部分是「图片 / 视频生成」：默认沿用上面的网关地址与口令，模型 id 用 fal.ai 的写法（默认 `fal-ai/flux/dev` 与 `fal-ai/kling-video/v1/standard/text-to-video`）。真实的 fal key 存在网关的 Worker 密钥 `FAL_KEY` 里，不在页面上：

```bash
npx wrangler secret put FAL_KEY --config gateway/wrangler.toml
npm run gateway:deploy
```

生成入口有两个：输入框左下角「+」里的「生成图片 / 生成视频」，以及直接让 Agent 生成（它会先给计划，确认后执行）。

## 数据

文稿与对话保存在浏览器 localStorage，图片 / 视频保存在 IndexedDB，按项目隔离。换浏览器或清缓存会丢失。旧版原型（分支 `main`）的剧本、文档、资产图片会在首次打开时自动转成文稿和媒体。
