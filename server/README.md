# WoW 后端

一个 Node 进程里三件事，可以单独用，也可以一起上：

| 这一块 | 路径 | 口令 | 没配好时 |
|---|---|---|---|
| 模型网关 | `/v1/chat/completions`、`/fal/*`、`/ark/*`、`/byteplus/*`、`/media` | `ACCESS_TOKEN` | — |
| 数据同步 | `/api/auth/*`、`/api/projects`、`/api/sync/*`、`/api/media/:id` | 用户 token | 没 `DATABASE_URL` 时回 503 |
| 服务端渲染 | `/api/render`、`/api/render/:id`、`/api/render/:id/file` | 用户 token | 渲染环境没装时回 503 |

三件事互不依赖：只想跑模型网关的话，不配数据库也能单独起。

## 跑起来

```bash
cd server
npm install
npm run setup          # vendor → runtime、打包渲染器、装无头 Chrome
cp .env.example .env   # 填 ACCESS_TOKEN 和各家模型 key
npm run db:up          # 本机 Postgres（docker compose，端口 5433）
npm run dev
```

`npm run setup` 里的三步也可以分开跑：`npm run sync:vendor`、`npm run build:renderer`、`npx playwright-core install chromium-headless-shell`。

**国内拉 Docker 镜像**：Docker Hub 连不上，用镜像站再打个 tag：

```bash
docker pull docker.m.daocloud.io/library/postgres:17-alpine && docker tag docker.m.daocloud.io/library/postgres:17-alpine postgres:17-alpine
```

## 渲染是怎么跑的

```
画面-NN.json
   └─ prepareJob      写成任务目录：index.html + spec.json + media/
        └─ readcheck      上游原版工具：每块文字停留时间够不够读
        └─ video.mjs      playwright 开 N 个无头 Chrome 逐帧截 JPEG → ffmpeg 编码 → 合段
             └─ blobs.put  成片进对象存储，库里记 object_key
```

关键在于 **渲染核心只有一份**。`src/lib/render/` 下的 `spec / theme / text / paint` 四个文件是纯逻辑，
浏览器里由 `video.ts`（WebCodecs + mediabunny）驱动做即时预览，服务端由 playwright + ffmpeg 驱动出成片，
两边画出来的帧逐像素相同。改了渲染代码跑一次 `npm run build:renderer`，服务端立刻跟上。

渲染页（`runtime/wow/page.js`）暴露的是上游那套页面契约：

```js
window.DUR        // 总时长
window.render(t)  // 画 t 时刻这一帧，确定性
window.READY      // 字体图片就绪
window.TEXTS(t)   // 这一刻屏幕上的文字，给 readcheck
window.EV         // 段落 cue，给混音
```

所以上游 `core/render/` 下的工具不用改一行就能跑我们的内容；以后让模型自己写风格页（B 路线），
只要它也满足这份契约，走的是同一条管线。

## vendor/lemo-opuscar

[lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) 的原样镜像，MIT，Copyright (c) 2026 LemoLab。
**不要改这里面的文件**，要改就在 `src/` 里包一层——这样上游更新了能直接覆盖。

`npm run sync:vendor` 把它拷进 `runtime/core/`（拷贝不是软链：上游的 `page.mjs` 用 `import.meta.url`
往上两级算静态根，软链会被 Node 解析成真实路径，根就算错了）。

已经用上的：`lib.js`（关键帧插值，另见前端的 `src/lib/render/curve.ts`）、`render/video.mjs`（逐帧渲染）、
`render/page.mjs` `browser.mjs` `serve.mjs`（页面与静态服务）、`render/readcheck.mjs`（可读时间自检）、
`render/still.mjs`（抽样出图）、`render/mux.sh`（两遍 loudnorm 到 −14 LUFS 的封装）、`render/srt.py`。
还没接的：`core/audio/`（采样器、拨弦物理建模、程序化拟音）与 `core/tts/`（其中 `asr_check.py` 值得优先接，
它把每句合成出来的配音转写回来跟原文比对，不一致就重做——我们现在完全没有这道校验）。

## 库表

`db/001_init.sql`（业务表）、`002_settings.sql`（服务端配置与一次性口令）、`003_accounts.sql`（管理员、密码重置）。
迁移按文件名顺序在进程启动时自动跑，跑过的记在 `migrations` 表里。四条贯穿全表的约定写在 001 开头，改表前先读：
所有业务表挂 `user_id`、主键沿用前端的字符串 id、`updated_at` 是同步依据、删除一律软删。

同步是 last-write-wins：推上来的比库里新才覆盖，冲突不在服务端猜，由前端提示用户。

## 上线（阿里云）

先香港节点（免 ICP 备案），备案并行走，批下来再把国内节点加上做主力。

- **ECS**：渲染吃 CPU，2 核起步、4 核舒服；3D 与着色器风格以后要 GPU 实例。要装 Node 20+、ffmpeg 7+、Python 3.11+。
  ffmpeg 必须 7 以上：6.x 在 `loudnorm` 下会少报音频长度，`mux.sh` 会据此判定文件被截断而拒绝。
- **RDS PostgreSQL**：把 `DATABASE_URL` 指过去，迁移在进程启动时自动跑。
- **OSS**：`src/oss.mjs` 是自写的最小客户端（V4 签名，`test/oss.test.mjs` 用官方 SDK 的测试向量钉着，不装 ali-oss），
  `store.mjs` 每次调用按当前配置（库 > .env）选 OSS 或本机磁盘，配置在网页「服务器设置 → 媒体存储」里填。
  配了 OSS 就只往 OSS 写，写不进去直接报错——故意没有「退回本机磁盘」的兜底，那样文件会散在两处、重装机器就丢。
  读的时候 OSS 里没有才看本机（过渡期），`scripts/migrate-blobs.mjs` 把老文件搬过去。
- **账号**：第一个账号是管理员（`users.is_admin`），`/api/settings`、`/api/admin/*` 只有它能用。注册靠设置项 `INVITE_CODE`
  （空 = 不开放），密码重置靠管理员生成的 `/?reset=<token>` 链接（`password_resets` 存 SHA-256、24 小时、一次性），
  管理员自己忘了用 `npm run reset:link -- 邮箱`。没有邮件服务，链接是人传人。
- 渲染任务只在内存里排队，进程重启时会把 `queued` / `running` 的任务标成失败让前端重试，
  而不是让它们永远停在「渲染中」。要多机器跑的时候，这里换成数据库队列或消息队列。
