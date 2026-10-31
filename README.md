# WoW · 对话 + 文件工作区

用对话做视频的创作工具。左边导航，中间跟 Agent 说话，右边是文件工作区 —— 剧本、分镜表、人物小传、视频提示词都是 Markdown 文稿，图片和视频在媒体区，Agent 写东西时在右边逐行写出来。

两条产品线共用一套骨架：

- **影视类**（广告 / 故事片 / 剧集 / 短片 / MV）：画面交给视频模型生成，按次计费、要等几分钟。
- **科普类**：画面**由代码逐帧渲染**，不碰任何视频模型 —— 不花钱、几秒出片、改一个字重渲就行。实测 45 秒的 1080×1920 片子编码 5.9 秒。

线上地址 **https://47-238-73-78.sslip.io** （页面和接口同源）

---

## 快速上手

```bash
npm install
npm run dev        # http://localhost:5174
```

| 命令 | 做什么 |
|---|---|
| `npm run dev` | 开发服务器，改代码自动刷新 |
| `npm run check` | 类型检查（tsc），**提交前必须过** |
| `npm test` | 单元测试，**提交前必须过** |
| `npm run build` | 构建到 `dist/` |
| `npm run deploy` | **一条命令上线**：跑闸 → push → 服务器重建 → 自检 |
| `npm run backup` | **把线上数据备份到自己电脑**（异地备份） |

开发时要连后端（调同步、登录、模型网关），用 `.claude/launch.json` 里的 `moodio-ui-with-backend`，或者：

```bash
cd server && npm run db:up && npm run dev        # 后端在 8787
WOW_API=http://127.0.0.1:8787 npm run dev        # 前端代理到它
```

---

## 架构：东西都在哪

```
┌─ 浏览器 ───────────────────────────────────┐
│  React 前端                                 │
│    数据主力在本地：localStorage + IndexedDB   │  ← 离线也能用
│    科普视频在这里渲染：canvas 逐帧 + WebCodecs │  ← 不经过服务器
└───────────────┬─────────────────────────────┘
                │ 同源 HTTPS（Caddy 一并发页面和接口）
┌───────────────┴─────────────────────────────┐
│  阿里云香港 ECS                               │
│    Caddy      发 dist/，/api /v1 /fal … 反代  │
│    Node 后端   8787                          │
│      ├ 模型网关   转发给 DeepSeek / Kimi / fal │  ← 真 key 只在这里
│      ├ 数据同步   last-write-wins             │
│      └ 服务端渲染  playwright + ffmpeg         │
│    PostgreSQL  账号 / 创作 / 文稿 / 媒体元数据  │
│    本机磁盘     媒体文件（以后换 OSS）          │
└─────────────────────────────────────────────┘
```

**前端** Vite + React 19 + TypeScript，状态用 zustand，媒体 blob 存 IndexedDB。

| 想改什么 | 去哪 |
|---|---|
| 界面布局 | `src/App.tsx`、`src/components/` |
| 样式、配色 | `src/styles.css`（颜色都是 `:root` 里的变量） |
| Agent 怎么回话、怎么执行 | `src/lib/agent/`（`runner` 回复与执行、`prompt` 系统提示、`tools` 工具） |
| 下一步该干什么 | `src/lib/director.ts`（影视类）、`director-explainer.ts`（科普类） |
| 科普视频的画面长什么样 | `src/lib/render/`（`paint.ts` 十三个模板、`theme.ts` 配色） |
| 写作规范、格式硬规则 | `src/lib/guides.ts` |
| 数据怎么存、怎么同步 | `src/lib/store.ts`、`sync.ts` |

**后端** Node（无框架）+ PostgreSQL。三件事互不依赖，挂一个不影响另外两个。

| | 入口 |
|---|---|
| HTTP 入口、渲染队列 | `server/src/index.mjs` |
| 模型网关 | `server/src/gateway.mjs` |
| 账号 / 同步 / 存储 | `server/src/auth.mjs`、`sync.mjs`、`store.mjs` |
| 服务端渲染 | `server/src/render/job.mjs` |
| 库表 | `server/db/*.sql` |
| 部署与备份 | `server/deploy/` |
| 上游镜像（MIT，**别改**） | `server/vendor/lemo-opuscar/` |

---

## 流程：代码怎么上线

**GitHub 是唯一的真相，服务器只是它的一个副本。**

```
本机改代码 → npm run check && npm test → 浏览器里看一眼
          → git commit && git push
          → npm run deploy      ← 服务器从 GitHub 拉下来重建重启
```

**不要直接改服务器上的文件。** `setup.sh` 第一件事就是 `git reset --hard`，手改的东西下次部署会被无声地冲掉 —— 这种丢失没有任何报错。

分支只有一个 `main`。历史版本留在 tag 里（`v0-prototype`、`v0-split-workspace`）。

详细的运维手册（部署、备份、恢复、出事了怎么办）在 [docs/运维.md](docs/运维.md)。

---

## 给 AI agent 的说明

- **[CLAUDE.md](CLAUDE.md)** —— 项目约定的唯一出处。不只写「代码长什么样」，更写「为什么这么写」和「踩过什么坑」。改代码前读它。
- **[AGENTS.md](AGENTS.md)** —— 给 Codex 等其他 agent 的入口，内容就是指向上面那份 + 几条铁律。

---

## 数据与隐私

- 文稿、对话在浏览器 localStorage，图片视频在 IndexedDB，**按创作隔离**。
- 在「服务器设置」里登录之后会自动同步到后端，换台机器登录就能取回来。没登录就只在本机。
- **模型 key 不进浏览器**：真 key 存在服务器上，页面只带一个访问口令。key 在「服务器设置」里填，填完即时生效。
- 任何 API key 都不许进仓库、不许进对话。
