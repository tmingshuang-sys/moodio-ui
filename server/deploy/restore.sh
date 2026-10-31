#!/usr/bin/env bash
# 从一份备份恢复。用法：
#   sudo bash /opt/wow/server/deploy/restore.sh /var/backups/wow/wow-20261101-033000.tar.gz
#   sudo bash /opt/wow/server/deploy/restore.sh --latest
#
# 这个脚本会覆盖现在的数据库和媒体文件。它会先把当前状态另存一份再动手，
# 所以恢复错了还能退回去——但还是要看清楚再敲回车。
#
# 没恢复过的备份不算备份。装好之后至少演练一次：跑一次 backup.sh，
# 随便改点数据，再 restore 回来，确认东西真回来了。
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/wow}
OUT_DIR=${OUT_DIR:-/var/backups/wow}
SRC=${1:-}
[ "$(id -u)" = 0 ] || { echo "要用 root 跑：sudo bash $0 <备份文件>"; exit 1; }

if [ "$SRC" = "--latest" ] || [ -z "$SRC" ]; then
  SRC=$(ls -1t "$OUT_DIR"/wow-*.tar.gz 2>/dev/null | head -1 || true)
  [ -n "$SRC" ] || { echo "$OUT_DIR 里没有备份"; exit 1; }
fi
[ -f "$SRC" ] || { echo "找不到 $SRC"; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
tar -xzf "$SRC" -C "$WORK"
[ -f "$WORK/db.dump" ] || { echo "$SRC 里没有 db.dump，不像是本脚本产出的备份"; exit 1; }

echo "准备恢复：$SRC"
[ -f "$WORK/commit.txt" ] && echo "备份时的代码版本：$(cat "$WORK/commit.txt")"
echo "这会覆盖当前的数据库和媒体文件。"
read -rp "确认请输入 yes：" ok
[ "$ok" = yes ] || { echo "取消了"; exit 1; }

# 动手之前先把现状另存一份，恢复错了能退回去
echo "== 先备份当前状态"
OUT_DIR="$OUT_DIR" APP_DIR="$APP_DIR" bash "$APP_DIR/server/deploy/backup.sh"

echo "== 停服务"
systemctl stop wow-server || true

echo "== 恢复数据库"
# 删库重建而不是往现有库里灌：pg_restore --clean 遇到备份里没有的新表不会清掉，会留下串味的残留
su - postgres -c "dropdb --if-exists wow && createdb -O wow wow"
su - postgres -c "pg_restore -d wow --no-owner --role=wow" < "$WORK/db.dump"

echo "== 恢复媒体文件"
if [ -f "$WORK/blobs.tar.gz" ]; then
  rm -rf "$APP_DIR/server/blobs"
  tar -xzf "$WORK/blobs.tar.gz" -C "$APP_DIR/server"
  chown -R wow:wow "$APP_DIR/server/blobs"
fi

# .env 不自动覆盖：现在这台机器的数据库密码可能和备份时不一样，盖回去反而连不上库。
# 需要里面的网关口令时自己看一眼 $WORK 解出来的 env——但那个目录退出就删了，所以先留一份
if [ -f "$WORK/env" ]; then
  cp "$WORK/env" "$OUT_DIR/env-from-backup"; chmod 600 "$OUT_DIR/env-from-backup"
  echo "备份里的配置放在 $OUT_DIR/env-from-backup（没有自动覆盖 .env，因为数据库密码可能已经换了）"
fi

echo "== 起服务"
systemctl start wow-server
sleep 3
curl -fsS --noproxy '*' http://127.0.0.1:8787/health && echo
echo "恢复完成。"
