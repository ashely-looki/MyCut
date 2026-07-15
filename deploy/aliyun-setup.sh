#!/usr/bin/env bash
# 阿里云海外（新加坡/香港等，免备案）2核4G 一键部署脚本。
# 做的事：加 swap（防成片 OOM）→ 装 Docker + compose → 构建并起服务。
# 海外机器直连 Docker Hub / npm / Chromium 官方源，无需国内镜像加速。
#
# 用法（在服务器上，项目根目录）：
#   sudo bash deploy/aliyun-setup.sh
#
# 前提：已 git clone 本项目、已把 .env.production 准备好（见 .env.production.example）。
# 幂等：重复运行安全（已装的跳过、swap 已存在则跳过）。
#
# 如果将来换成【国内机房】机器，构建慢时改用：
#   docker compose build --build-arg CN_MIRROR=1 && docker compose up -d
# （Dockerfile 里 CN_MIRROR=1 会切阿里云 apt / 阿里云 PyPI / npmmirror）

set -euo pipefail

log() { echo -e "\033[1;32m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 运行：sudo bash deploy/aliyun-setup.sh"; exit 1
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
log "项目目录：$PROJECT_DIR"

# ---------- 0. 检查 .env.production ----------
if [ ! -f .env.production ]; then
  warn "缺少 .env.production，先复制模板并按需填写："
  echo "  cp .env.production.example .env.production && vi .env.production"
  exit 1
fi

# ---------- 1. Swap（2核4G 跑 1080p 渲染防 OOM 的保命项）----------
if swapon --show 2>/dev/null | grep -q '/swapfile'; then
  log "swap 已存在，跳过"
else
  log "创建 2G swap（防成片渲染 OOM）"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # 降低 swappiness：优先用物理内存，swap 只作 OOM 兜底
  sysctl -w vm.swappiness=10 || true
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

# ---------- 2. 装 Docker（兼容 Ubuntu/Debian 与 Alibaba Cloud Linux/CentOS）----------
if command -v docker >/dev/null 2>&1; then
  log "Docker 已安装：$(docker --version)"
else
  log "安装 Docker"
  if command -v dnf >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then
    # Alibaba Cloud Linux / CentOS / RHEL 系：用 dnf/yum + 阿里云 docker-ce 源
    PKG="$(command -v dnf || command -v yum)"
    log "检测到 RHEL 系（Alibaba Cloud Linux/CentOS），用 $PKG 安装"
    $PKG install -y dnf-plugins-core yum-utils 2>/dev/null || true
    # 阿里云 docker-ce 源对 Alibaba Cloud Linux 兼容最好（用 centos 8 源）
    $PKG config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo 2>/dev/null \
      || yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
    # Alibaba Cloud Linux 3 的 releasever 需指向 centos 8，避免找不到包
    sed -i 's|$releasever|8|g' /etc/yum.repos.d/docker-ce.repo 2>/dev/null || true
    $PKG install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin \
      || $PKG install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin --nobest
  else
    # Ubuntu/Debian 系：官方脚本
    log "检测到 Debian 系，用官方脚本安装"
    curl -fsSL https://get.docker.com | bash
  fi
  systemctl enable --now docker
fi

# 校验 docker compose 子命令可用（老版本可能只有 docker-compose）
COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    warn "docker compose 插件缺失，尝试安装"
    (command -v dnf >/dev/null 2>&1 && dnf install -y docker-compose-plugin) || true
  fi
fi
log "使用 compose 命令：$COMPOSE"

# ---------- 3. 构建并启动 ----------
# --env-file 让 .env.production 既作后端运行时变量，又作 compose 变量替换源
# （前端 Supabase 构建变量靠它注入，否则登录门不显示）。
log "构建镜像并启动（首次较久：装 Remotion + 下 Chromium）"
$COMPOSE --env-file .env.production up -d --build

log "完成。查看状态： $COMPOSE ps"
log "查看后端日志： $COMPOSE logs -f backend"
PUBLIC_IP="$(curl -s -m 3 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || curl -s -m 3 ifconfig.me 2>/dev/null || echo '<服务器公网IP>')"
log "浏览器访问： http://${PUBLIC_IP}/    （需先在阿里云安全组放行 80 端口！）"
