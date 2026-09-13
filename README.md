# Moodio UI · Storyboard 原型

静态页面原型：`Moodio-UI-Refined-Storyboard.html`（结构）+ `src/styles.css`（样式）+ `src/*.js`（脚本，见 `src/README.md`）。

配套：`gateway/` 模型网关（Cloudflare Worker），`site/` 页面发布配置。线上地址 https://moodio-ui.moodio-ui.workers.dev

## 本地运行

不要直接双击打开（file:// 会拦截模型请求）。在本目录运行：

```bash
python3 -m http.server 8765
```

然后访问 http://127.0.0.1:8765/Moodio-UI-Refined-Storyboard.html

## 模型配置

在页面右下角 Agent 面板的 ✦ 菜单里填写 Base URL、API Key、模型名和思考模式。密钥只保存在本机浏览器。

## 数据

剧本、分镜、资产、对话保存在浏览器 localStorage / IndexedDB，与本文件无关。换浏览器或清缓存会丢失，请定期备份。
