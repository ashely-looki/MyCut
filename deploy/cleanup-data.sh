#!/usr/bin/env bash
# 磁盘清理：删除 N 天前的成片产物与实拍缓存。
#
# 为什么需要：单容器部署（AUTOCLIP_DESKTOP_MODE=1）不跑 Celery beat 定时任务，
# 代码里的 30 天自动清理不生效；而 hf_cache（实拍缓存）和 compose.mp4 永久累积，
# 盘会越用越满。放到 crontab 定期跑，或磁盘告急时手动跑。
#
# 用法（项目根目录）：
#   bash deploy/cleanup-data.sh          # 默认清 30 天前的
#   bash deploy/cleanup-data.sh 7        # 清 7 天前的
#
# 定时（每天凌晨 3 点清 30 天前）：
#   crontab -e 加一行：
#   0 3 * * * cd /root/my-clip-agent && bash deploy/cleanup-data.sh 30 >> /var/log/mycut-cleanup.log 2>&1

set -euo pipefail
DAYS="${1:-30}"

log() { echo -e "\033[1;32m[cleanup]\033[0m $*"; }

cd "$(dirname "$0")/.."

log "清理 ${DAYS} 天前的成片产物与实拍缓存 ..."

# 清理前占用
log "清理前后端容器磁盘占用："
docker compose exec -T backend sh -c 'du -sh /app/data /app/remotion/public 2>/dev/null' || true

# 1) 实拍缓存 hf_cache：删 N 天未访问的 mp4（同句命中缓存会更新 mtime，热数据不会误删）
docker compose exec -T backend sh -c "
  find /app/remotion/public/hf_cache -type f -name '*.mp4' -mtime +${DAYS} -delete 2>/dev/null || true
"

# 2) 旧成片/切片产物：删 N 天前的项目输出 mp4（保留数据库记录，只删大文件）
docker compose exec -T backend sh -c "
  find /app/data/projects -type f -name '*.mp4' -mtime +${DAYS} -delete 2>/dev/null || true
  find /app/data/output -type f -name '*.mp4' -mtime +${DAYS} -delete 2>/dev/null || true
"

# 3) 临时目录兜底
docker compose exec -T backend sh -c "
  find /app/data/temp -mindepth 1 -mtime +1 -delete 2>/dev/null || true
"

log "清理后后端容器磁盘占用："
docker compose exec -T backend sh -c 'du -sh /app/data /app/remotion/public 2>/dev/null' || true
log "完成。"
