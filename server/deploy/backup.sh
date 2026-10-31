#!/usr/bin/env bash
# 备份：数据库 + 媒体文件 + 配置，打成一个 tar.gz 放在 /var/backups/wow/。
# 由 wow-backup.timer 每天凌晨跑一次，也可以随时手动跑：sudo bash /opt/wow/server/deploy/backup.sh
#
# ⚠️ 备份文件里有密钥：模型 key 存在库的 settings 表里（明文，见 db/002_settings.sql），
#    .env 里有数据库密码和网关口令。所以文件权限是 600，拿到本机之后也别随手放进公开目录。
#
# 本机那份防的是「删错了 / 库坏了」；配了 OSS 之后每份还会传一份到 bucket 的 backups/ 下（30 天过期），
#    那才防得了「机器没了」。自己电脑上 npm run backup 仍然可以再拉一份回本机。
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/wow}
APP_USER=${APP_USER:-wow}
OUT_DIR=${OUT_DIR:-/var/backups/wow}
KEEP=${KEEP:-7}                      # 本机留几份
STAMP=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$OUT_DIR"; chmod 700 "$OUT_DIR"

# 数据库：custom 格式（自带压缩，恢复时能挑表）
su - postgres -c "pg_dump -Fc wow" > "$WORK/db.dump"

# 媒体文件：成片、参考图、配音。没有就建个空目录，免得 tar 报错
BLOBS="$APP_DIR/server/blobs"
[ -d "$BLOBS" ] || mkdir -p "$BLOBS"
tar -czf "$WORK/blobs.tar.gz" -C "$APP_DIR/server" blobs

# 配置：恢复时要用，里面有数据库密码与网关口令
cp "$APP_DIR/server/.env" "$WORK/env" 2>/dev/null || true

# 记一笔当时的代码版本，恢复时能对上。
# 必须 su 成 wow 跑：仓库属于 wow，root 直接进去 git 会被「dubious ownership」挡掉，
# 结果是 commit.txt 空文件——踩过一次，备份看着成功其实少了这一项
su - "${APP_USER:-wow}" -c "cd $APP_DIR && git log -1 --format='%H %ad %s' --date=iso" > "$WORK/commit.txt" 2>/dev/null || true

OUT="$OUT_DIR/wow-$STAMP.tar.gz"
tar -czf "$OUT" -C "$WORK" .
chmod 600 "$OUT"

# 轮转：只留最近 KEEP 份
ls -1t "$OUT_DIR"/wow-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

# 传一份到 OSS（配了 OSS 才传）——和数据库不在同一台机器上，这才算异地备份；生命周期规则 30 天自动过期。
# 失败不影响本机那份，只在输出里提醒。备份里有密钥，所以脚本会要求 OSS 服务端加密，bucket 也是私有的
NODE=${NODE:-/usr/local/bin/node}; command -v "$NODE" >/dev/null || NODE=$(command -v node || true)
OSS_KEY=""
if grep -q '^OSS_BUCKET=.\+' "$APP_DIR/server/.env" 2>/dev/null && [ -n "$NODE" ]; then
  if OSS_KEY=$("$NODE" --env-file="$APP_DIR/server/.env" "$APP_DIR/server/scripts/oss-backup.mjs" upload "$OUT" 2>/tmp/wow-backup-oss.err); then
    echo "已上传 OSS：$OSS_KEY"
  else
    echo "⚠️ 上传 OSS 失败：$(tail -1 /tmp/wow-backup-oss.err 2>/dev/null)（本机那份还在）"; OSS_KEY=""
  fi
fi

# 给网页「服务器设置 → 系统状态」看的：上次备份什么时候、多大、有没有传到 OSS。
# 服务跑在 wow 用户下读不了 700 的备份目录，所以单独写一份可读的状态文件
STATUS_FILE="$APP_DIR/server/.backup-status.json"
printf '{"file":"%s","size":%s,"at":"%s","ossKey":"%s"}\n' "$OUT" "$(stat -c %s "$OUT")" "$(date -u +%FT%TZ)" "$OSS_KEY" > "$STATUS_FILE"
chmod 644 "$STATUS_FILE"; chown "$APP_USER" "$STATUS_FILE" 2>/dev/null || true

# 这一行是给脚本解析的，路径后面不许再跟别的东西（backup.mjs 按 BACKUP_FILE= 取）
echo "BACKUP_FILE=$OUT"
echo "备份完成 $OUT（$(du -h "$OUT" | cut -f1)）"
echo "当前保留 $(ls -1 "$OUT_DIR"/wow-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') 份，最多 $KEEP 份"
