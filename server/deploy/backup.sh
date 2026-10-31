#!/usr/bin/env bash
# 备份：数据库 + 媒体文件 + 配置，打成一个 tar.gz 放在 /var/backups/wow/。
# 由 wow-backup.timer 每天凌晨跑一次，也可以随时手动跑：sudo bash /opt/wow/server/deploy/backup.sh
#
# ⚠️ 备份文件里有密钥：模型 key 存在库的 settings 表里（明文，见 db/002_settings.sql），
#    .env 里有数据库密码和网关口令。所以文件权限是 600，拿到本机之后也别随手放进公开目录。
#
# ⚠️ 只存在这台机器上的备份，防的是「删错了 / 库坏了」，防不了「机器没了」。
#    真正的异地备份是在自己电脑上跑 npm run backup，它会把最新一份拉回本机。
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/wow}
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

# 记一笔当时的代码版本，恢复时能对上
(cd "$APP_DIR" && git log -1 --format='%H %ad %s' --date=iso) > "$WORK/commit.txt" 2>/dev/null || true

OUT="$OUT_DIR/wow-$STAMP.tar.gz"
tar -czf "$OUT" -C "$WORK" .
chmod 600 "$OUT"

# 轮转：只留最近 KEEP 份
ls -1t "$OUT_DIR"/wow-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "备份完成 $OUT（$(du -h "$OUT" | cut -f1)）"
echo "当前保留 $(ls -1 "$OUT_DIR"/wow-*.tar.gz 2>/dev/null | wc -l | tr -d ' ') 份，最多 $KEEP 份"
