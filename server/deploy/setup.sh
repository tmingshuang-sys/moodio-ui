#!/usr/bin/env bash
# WoW 后端一键安装（Ubuntu 24.04，阿里云香港 ECS 实测）。可以重复跑：第二次是更新代码 + 重启。
#
#   sudo bash setup.sh --domain api.moodio.art
#
# 装什么、为什么：
#   Node 24 LTS   官方 tarball，不加 apt 源，版本自己说了算
#   ffmpeg 8.1    静态构建。Ubuntu 24.04 自带的是 6.1.1，不能用——6.x 在 loudnorm 下会少报音频长度，
#                 上游的 mux.sh 会据此判定文件被截断而拒绝封装
#   PostgreSQL    apt 装，建好库和账号，连接串写进 .env
#   Chromium      playwright 的 headless shell，逐帧截图用
#   Caddy         反向代理 + 自动签 HTTPS 证书（域名必须已经解析到这台机器，否则签不下来）
set -euo pipefail

# 这个脚本在「应用账号与代码」那一步会把自己 git reset 掉。bash 是按字节偏移边读边执行的，
# 文件在运行中变了长度就会跳到错位置——实测表现是装完打出的是上一版的文案。所以先拷一份到 /tmp 再跑。
SELF=$(readlink -f "$0" 2>/dev/null || echo "$0")
if [ "${WOW_REEXEC:-}" != 1 ] && [ -f "$SELF" ]; then
  cp "$SELF" /tmp/wow-setup-running.sh
  export WOW_REEXEC=1
  exec bash /tmp/wow-setup-running.sh "$@"
fi

DOMAIN=""
REPO="${WOW_REPO:-git@github.com:tmingshuang-sys/moodio-ui.git}"
BRANCH="${WOW_BRANCH:-redesign}"
APP_DIR=/opt/wow
APP_USER=wow
NODE_VERSION=v24.22.2
FFMPEG_TAG=n8.1

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --repo) REPO="${2:-}"; shift 2 ;;
    --branch) BRANCH="${2:-}"; shift 2 ;;
    *) echo "不认识的参数：$1"; exit 2 ;;
  esac
done

[ "$(id -u)" = 0 ] || { echo "要用 root 跑：sudo bash $0 ..."; exit 1; }
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

case "$(uname -m)" in
  x86_64)  NODE_ARCH=linux-x64;   FF_ARCH=linux64 ;;
  aarch64) NODE_ARCH=linux-arm64; FF_ARCH=linuxarm64 ;;
  *) echo "不支持的架构 $(uname -m)"; exit 1 ;;
esac

say "系统依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates xz-utils jq openssl postgresql postgresql-contrib \
  fonts-noto-cjk fonts-noto-color-emoji >/dev/null
# 中文字体必须装：渲染页里的中文全靠系统字体，缺了就是一屏豆腐块

say "Node ${NODE_VERSION}"
if [ "$(node -v 2>/dev/null || true)" != "$NODE_VERSION" ]; then
  tmp=$(mktemp -d)
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${NODE_ARCH}.tar.xz" -o "$tmp/node.tar.xz"
  tar -xJf "$tmp/node.tar.xz" -C "$tmp"
  rm -rf /usr/local/lib/nodejs && mkdir -p /usr/local/lib/nodejs
  mv "$tmp/node-${NODE_VERSION}-${NODE_ARCH}"/* /usr/local/lib/nodejs/
  ln -sf /usr/local/lib/nodejs/bin/node /usr/local/bin/node
  ln -sf /usr/local/lib/nodejs/bin/npm /usr/local/bin/npm
  ln -sf /usr/local/lib/nodejs/bin/npx /usr/local/bin/npx
  rm -rf "$tmp"
fi
node -v

say "ffmpeg（静态构建，不用系统自带的 6.x）"
if ! ffmpeg -version 2>/dev/null | head -1 | grep -qE 'version n?([7-9]|[1-9][0-9])'; then
  tmp=$(mktemp -d)
  url="https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-${FFMPEG_TAG}-latest-${FF_ARCH}-gpl-${FFMPEG_TAG#n}.tar.xz"
  curl -fsSL "$url" -o "$tmp/ff.tar.xz"
  tar -xJf "$tmp/ff.tar.xz" -C "$tmp"
  install -m755 "$tmp"/ffmpeg-*/bin/ffmpeg /usr/local/bin/ffmpeg
  install -m755 "$tmp"/ffmpeg-*/bin/ffprobe /usr/local/bin/ffprobe
  rm -rf "$tmp"
fi
ffmpeg -version | head -1

say "PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1 || service postgresql start || true
PG_PASS_FILE=/etc/wow-db-password
if [ ! -f "$PG_PASS_FILE" ]; then openssl rand -base64 24 | tr -d '/+=' > "$PG_PASS_FILE"; chmod 600 "$PG_PASS_FILE"; fi
PG_PASS=$(cat "$PG_PASS_FILE")
su - postgres -c "psql -tAc \"select 1 from pg_roles where rolname='wow'\"" | grep -q 1 \
  || su - postgres -c "psql -c \"create role wow login password '${PG_PASS}'\"" >/dev/null
su - postgres -c "psql -tAc \"select 1 from pg_database where datname='wow'\"" | grep -q 1 \
  || su - postgres -c "createdb -O wow wow" >/dev/null
su - postgres -c "psql -c \"alter role wow password '${PG_PASS}'\"" >/dev/null

say "应用账号与代码"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"; chown -R "$APP_USER:$APP_USER" "$APP_DIR"
if [ "${WOW_SKIP_GIT:-0}" = 1 ]; then
  echo "跳过取代码（WOW_SKIP_GIT=1，容器里验证脚本时用）"
elif [ -d "$APP_DIR/.git" ]; then
  su - "$APP_USER" -c "cd $APP_DIR && git fetch --depth 1 origin $BRANCH && git reset --hard origin/$BRANCH"
else
  su - "$APP_USER" -c "git clone --depth 1 -b $BRANCH $REPO $APP_DIR"
fi

# 代码就位后再 chown 一次：重复跑时 root 可能在目录里建过东西，漏掉的话 npm 和构建会写不进去
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

say "安装与构建"
# 前端：VITE_API_BASE=/v1 让页面走相对路径，和后端同源，不需要 CORS
su - "$APP_USER" -c "cd $APP_DIR && npm install --no-audit --no-fund"
su - "$APP_USER" -c "cd $APP_DIR && VITE_API_BASE=/v1 npm run build"
su - "$APP_USER" -c "cd $APP_DIR/server && npm install --no-audit --no-fund"
su - "$APP_USER" -c "cd $APP_DIR/server && npm run sync:vendor && npm run build:renderer"
# 无头 Chrome 的系统依赖要 root 装，浏览器本身装进应用账号的缓存
npx --yes playwright-core@1.63.0 install-deps chromium >/dev/null 2>&1 || \
  apt-get install -y -qq libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 >/dev/null
su - "$APP_USER" -c "cd $APP_DIR/server && npx playwright-core install chromium-headless-shell"

say "配置"
ENV_FILE="$APP_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  TOKEN=$(openssl rand -hex 16)
  cat > "$ENV_FILE" <<EOF
# 这台机器上的后端配置。模型 key 现在可以先不填：不填的话网关对应的那几条路返回 503，
# 页面继续用原来的 Cloudflare 网关也能跑，渲染与数据同步不受影响。
PORT=8787
ALLOWED_ORIGINS=${DOMAIN:+https://}${DOMAIN}${DOMAIN:+,}https://wow.moodio.art,https://moodio-ui.moodio-ui.workers.dev,http://localhost:5174
ACCESS_TOKEN=${TOKEN}
DATABASE_URL=postgres://wow:${PG_PASS}@127.0.0.1:5432/wow

DEEPSEEK_API_KEY=
KIMI_API_KEY=
FAL_KEY=
ARK_API_KEY=
BYTEPLUS_API_KEY=
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
else
  # 已经有 .env 就只把数据库密码对齐，其余保留（第二次跑不要把填好的 key 冲掉）
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://wow:${PG_PASS}@127.0.0.1:5432/wow#" "$ENV_FILE"
fi

if [ "${WOW_SKIP_SERVICES:-0}" != "1" ]; then
  say "systemd"
  sed -e "s#@APP_DIR@#$APP_DIR#g" -e "s#@APP_USER@#$APP_USER#g" "$APP_DIR/server/deploy/wow-server.service" > /etc/systemd/system/wow-server.service
  systemctl daemon-reload
  systemctl enable wow-server >/dev/null
  # 必须是 restart 而不是 enable --now：对已经在跑的服务 --now 什么都不做，
  # 重复跑（= 更新代码）时新代码根本不会生效，连库迁移都不会跑
  systemctl restart wow-server
  sleep 3
  systemctl --no-pager --lines=12 status wow-server || true

  say "每日备份"
  sed -e "s#@APP_DIR@#$APP_DIR#g" "$APP_DIR/server/deploy/wow-backup.service" > /etc/systemd/system/wow-backup.service
  cp "$APP_DIR/server/deploy/wow-backup.timer" /etc/systemd/system/wow-backup.timer
  systemctl daemon-reload
  systemctl enable --now wow-backup.timer >/dev/null
  systemctl list-timers wow-backup.timer --no-pager | head -2

  if [ -n "$DOMAIN" ]; then
    say "Caddy + HTTPS（$DOMAIN）"
    chmod o+rx /opt /opt/wow 2>/dev/null || true   # caddy 以自己的账号读 dist/，路径上要能穿过去
    if ! command -v caddy >/dev/null; then
      apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
      curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
      apt-get update -qq && apt-get install -y -qq caddy >/dev/null
    fi
    sed "s#@DOMAIN@#$DOMAIN#g" "$APP_DIR/server/deploy/Caddyfile.tmpl" > /etc/caddy/Caddyfile
    systemctl reload caddy || systemctl restart caddy
  fi
fi

say "自检"
sleep 2
curl -fsS --noproxy '*' http://127.0.0.1:8787/health | tee /tmp/wow-health.json; echo
if [ -n "$DOMAIN" ]; then
  # Let's Encrypt 签证书要十几秒到一分钟，自检紧跟着跑往往还没好，会打出一行吓人的 TLS 错误。等它。
  printf '等证书签发'
  for _ in $(seq 1 24); do
    if curl -fsS -m 5 -o /dev/null "https://$DOMAIN/health" 2>/dev/null; then echo " 好了"; break; fi
    printf '.'; sleep 5
  done
  echo
  echo -n "外网接口："; curl -fsS -m 10 "https://$DOMAIN/health" && echo || echo "（签不下来：确认 $DOMAIN 解析到这台机器、安全组放行了 80 和 443，然后 systemctl reload caddy；日志 journalctl -u caddy -n 50）"
  echo -n "外网页面："; curl -fsS -m 10 -o /dev/null -w "HTTP %{http_code}\n" "https://$DOMAIN/" || true
fi

if [ -n "$DOMAIN" ]; then SITE_URL="https://$DOMAIN"; else SITE_URL="http://<这台机器的IP>:8787"; fi

# 还没有账号时后端会备一个一次性口令，拿着它在页面上创建第一个账号（用完即失效）
SETUP_TOKEN=$(su - postgres -c "psql -d wow -tAc \"select token from setup_tokens where used_at is null order by created_at desc limit 1\"" 2>/dev/null | tr -d ' ' || true)
if [ -n "$SETUP_TOKEN" ]; then
  ACCOUNT_LINE="首次初始化口令   $SETUP_TOKEN
                 打开页面 → 侧栏底部设置 → 服务器设置，用它创建第一个账号（用完即失效）"
else
  ACCOUNT_LINE="账号             已创建过，页面上登录即可"
fi

cat <<EOF

================ 装好了 ================
打开这个地址就能用   ${SITE_URL}（页面与接口同源）
网关口令   $(grep '^ACCESS_TOKEN=' "$ENV_FILE" | cut -d= -f2)
$ACCOUNT_LINE
配置文件   $ENV_FILE
看日志     journalctl -u wow-server -f
重启       systemctl restart wow-server
更新代码   sudo bash $APP_DIR/server/deploy/setup.sh${DOMAIN:+ --domain $DOMAIN}
备份       每天 3:30 自动跑，存在 /var/backups/wow（留最近 7 份）
           手动备份 sudo bash $APP_DIR/server/deploy/backup.sh
           恢复     sudo bash $APP_DIR/server/deploy/restore.sh --latest
           拉回本机 在自己电脑的项目目录里跑 npm run backup

模型 key 和网关口令都在页面上改：侧栏底部设置 → 服务器设置。填完即时生效，
不用再进终端、不用重启。在填好之前网关那几条路会回 503，渲染和数据同步不受影响。
========================================
EOF
