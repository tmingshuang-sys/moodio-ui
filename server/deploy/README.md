# 部署到阿里云香港（你要做的只有三件事）

选香港不选国内节点，是因为香港免 ICP 备案，今天就能上线；备案可以并行走，批下来再把国内节点加上做主力。

域名用 `api.moodio.art`。注意这**不需要**把 `moodio.art` 的 zone 转到哪个账号——
zone 在哪个账号只影响「把 Cloudflare Worker 绑到域名」，给一台服务器加一条 DNS A 记录不受这个限制。

---

## 第 1 件：买机器

阿里云控制台 → 云服务器 ECS → 创建实例：

| 项 | 选什么 |
|---|---|
| 地域 | **中国香港** |
| 规格 | 2 核 4G（`ecs.e-c1m2.large` 之类的经济型就够） |
| 镜像 | **Ubuntu 24.04 64 位** |
| 系统盘 | 40 GB ESSD |
| 公网 | 分配公网 IPv4，按使用流量，带宽峰值 5 Mbps 起 |
| 安全组 | 放行 **22、80、443** |
| 登录 | 设一个 root 密码（后面用控制台的网页终端，不用配 SSH 客户端） |

按量付费约 ¥0.14/小时，不用就释放。长期跑的话包年包月更划算。

> 渲染吃 CPU：45 秒的片子在 2 核上大约 1 分钟。以后要跑 3D 和着色器风格再换带 GPU 的实例。

## 第 2 件：加一条 DNS

在管理 `moodio.art` 的那个 Cloudflare 账号里：

- 类型 `A`，名称 `api`，内容填机器的公网 IP
- **代理状态必须是「仅限 DNS」（灰云）**，不要开橙色代理——开了的话 Let's Encrypt 的验证会打到 Cloudflare 而不是这台机器，证书签不下来

## 第 3 件：在网页终端里粘两段

ECS 实例列表 → 远程连接 → 用 root 登录，然后：

**第一段**（建账号、生成部署密钥、打印公钥）：

```bash
sudo bash -c 'useradd --system --create-home --shell /bin/bash wow 2>/dev/null; install -d -m700 -o wow -g wow /home/wow/.ssh; sudo -u wow ssh-keygen -t ed25519 -N "" -f /home/wow/.ssh/id_ed25519 -q </dev/null; sudo -u wow bash -c "ssh-keyscan github.com >> ~/.ssh/known_hosts" 2>/dev/null; mkdir -p /opt/wow; chown wow:wow /opt/wow; echo; echo "把下面这一行整个复制："; echo; cat /home/wow/.ssh/id_ed25519.pub'
```

把打印出来的那一行公钥，粘到 GitHub：仓库 → Settings → Deploy keys → Add deploy key（标题随便写，**不要勾** Allow write access）。

**第二段**（取代码并全自动安装，约 10 分钟）：

```bash
sudo -u wow git clone --depth 1 -b redesign git@github.com:tmingshuang-sys/moodio-ui.git /opt/wow && sudo bash /opt/wow/server/deploy/setup.sh --domain api.moodio.art
```

跑完会打印后端地址和网关口令。把那串口令发我，我接着把前端接过去。

---

## 脚本装了什么

| | 为什么 |
|---|---|
| Node 24 LTS（官方 tarball） | 不加 apt 源，版本自己说了算 |
| **ffmpeg 8.1 静态构建** | Ubuntu 24.04 自带的是 6.1.1，**不能用**——6.x 在 `loudnorm` 下会少报音频长度，封装那步会误判文件被截断而拒绝 |
| PostgreSQL | 建好库与账号，连接串自动写进 `.env`，库表在服务启动时自动迁移 |
| Noto CJK 字体 | 渲染页的中文靠系统字体，缺了就是一屏豆腐块 |
| Chromium headless shell | 逐帧截图 |
| Caddy | 反向代理 + 自动签 HTTPS 证书 |

脚本可以重复跑，第二次是更新代码 + 重启，不会冲掉 `.env` 里填好的 key。

## 装完之后

```bash
journalctl -u wow-server -f
```

```bash
sudo systemctl restart wow-server
```

更新到最新代码：

```bash
sudo bash /opt/wow/server/deploy/setup.sh --domain api.moodio.art
```

**模型 key 先不用填。** 不填的话网关那几条路返回 503，页面继续用原来的 Cloudflare 网关，
渲染和数据同步照常工作。想把网关也搬过来，编辑 `/opt/wow/server/.env` 填好再重启即可。

## 已知差异：服务端的字比预览里的略有不同

渲染核心两边是同一份代码，但**字体是系统给的**：macOS 上是苹方，Ubuntu 上是 Noto Sans CJK，
所以同一帧的字形和标点位置会有细微差别（在同一台机器上比较时是逐像素相同的，跨系统不是）。
正解是把字体随页面一起发（`.woff2`，按用到的字做子集，上游 `core/fonts/` 就是这么做的），
还没做。在那之前，**以服务端渲染出来的成片为准**，浏览器里的预览当排版草稿看。

## 如果不想用部署密钥

两个替代：把仓库设为公开（里面没有密钥，`.env` 和 `vendor` 的产物都已 gitignore），
或者告诉我，我把一份可部署的压缩包发给你，用控制台的文件上传放上去，再跑同一个 `setup.sh`。
