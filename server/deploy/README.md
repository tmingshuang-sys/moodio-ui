# 从零装一台新机器

现在这台机器怎么运维（部署、备份、排障）看 [docs/运维.md](../../docs/运维.md)。这份只讲**再开一台**要做什么。

## 1. 买机器

阿里云控制台 → 云服务器 ECS → 创建实例：

| 项 | 选什么 |
|---|---|
| 地域 | **中国香港**（免 ICP 备案，今天就能上线） |
| 规格 | 2 核 4G（`ecs.e-c1m2.large` 这类经济型够用） |
| 镜像 | **Ubuntu 24.04 64 位** |
| 系统盘 | 40 GB ESSD |
| 公网 | 分配公网 IPv4，按使用流量，带宽峰值 5 Mbps 起 |
| 安全组 | 放行 **22、80、443**（默认安全组是关着 80 / 443 的，要自己勾） |
| 登录 | 设一个 root 密码 |

按量付费约 ¥0.14/小时。买的时候注意别勾上「文件备份」「主机全面防护」，那些是另外收费的。

> 渲染吃 CPU：45 秒的片子在 2 核上约 2 分钟（Mac 上 16 秒）。以后要跑 3D 或着色器风格再换带 GPU 的。

## 2. 域名：可以不买

地址直接用 `<公网IP用短横线连起来>.sslip.io`，比如 IP 是 `47.238.73.78` 就是 `47-238-73-78.sslip.io`。sslip.io 会把这种名字解析回名字里的那个 IP，所以不用买域名、不用配 DNS，Let's Encrypt 也签得下证书。

要用自己的域名：加一条 A 记录指到这台机器就行。如果域名托在 Cloudflare，**代理状态必须是「仅限 DNS」（灰云）** —— 开了橙色代理，Let's Encrypt 的验证会打到 Cloudflare 而不是这台机器，证书签不下来。

## 3. 一条命令装完

ECS 实例列表 → 远程连接 → root 登录，然后（约 10 分钟）：

```bash
sudo useradd --system --create-home --shell /bin/bash wow 2>/dev/null; \
sudo mkdir -p /opt/wow && sudo chown wow:wow /opt/wow && \
sudo -u wow git clone --depth 1 -b main https://github.com/tmingshuang-sys/moodio-ui.git /opt/wow && \
sudo bash /opt/wow/server/deploy/setup.sh --domain <你的IP用短横线>.sslip.io
```

仓库是公开的，取代码不用任何凭据。跑完会打印页面地址、网关口令，以及**创建第一个账号用的一次性口令** —— 打开页面 → 侧栏底部设置 → 服务器设置，用它建账号，然后在同一个弹窗里填模型 key。

之后想让自己电脑上的 `npm run deploy` 指到这台新机器：

```bash
WOW_INSTANCE=i-xxxx WOW_REGION=cn-hongkong WOW_DOMAIN=<新地址> npm run deploy
```

或者改 `scripts/remote.mjs` 里的 `HOST`。

---

## 脚本装了什么

| | 为什么 |
|---|---|
| Node 24 LTS | 官方 tarball，不加 apt 源，版本自己说了算 |
| **ffmpeg 8.1 静态构建** | Ubuntu 24.04 自带的 6.1.1 **不能用** —— 6.x 在 loudnorm 下会少报音频长度，上游的 `mux.sh` 会据此判定文件被截断而拒绝封装 |
| PostgreSQL | 建库建账号，连接串写进 `.env` |
| Chromium headless shell | playwright 用它逐帧截图 |
| 中文字体 | `fonts-noto-cjk`。缺了渲染出来就是一屏豆腐块 |
| Caddy | 同时发 `dist/` 和反代 `/api /v1 /fal /ark /byteplus /media`，自动签 HTTPS |
| 每日备份 | `wow-backup.timer`，凌晨 3:30，留最近 7 份 |

脚本**可以重复跑**，第二次就是「更新代码 + 重启」，不会冲掉 `.env` 里填好的 key。

### 两个反直觉的地方，别「优化」掉

1. **开头把自己拷到 `/tmp` 再 `exec`。** 脚本跑到一半会 `git reset --hard` 掉自己，而 bash 是按字节偏移边读边执行的 —— 文件在运行中变了长度就会跳到错位置。症状是装完打出上一版的文案，中间步骤被悄悄跳过。

2. **systemd 那步是 `enable` + `restart`，不是 `enable --now`。** `--now` 对已经在跑的服务什么都不做，于是「更新代码」只换了磁盘上的文件，进程还是旧的，库迁移也不会跑（迁移在 `index.mjs` 启动时执行）。
