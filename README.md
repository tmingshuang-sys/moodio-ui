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

## 数据

文稿与对话保存在浏览器 localStorage，图片 / 视频保存在 IndexedDB，按项目隔离。换浏览器或清缓存会丢失。旧版原型（分支 `main`）的剧本、文档、资产图片会在首次打开时自动转成文稿和媒体。
