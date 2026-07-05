"""桌面模式启动入口（my-clip-agent 自有）。

与原 backend/main.py（硬编码 web 模式、依赖 Redis/Celery）不同：
- 启动最开头加载项目根目录的 .env，保证 AUTOCLIP_DESKTOP_MODE 等变量在
  任何 backend 模块被导入前就已就位（celery_app 在导入时即读该变量）。
- 强制桌面模式：任务在后台线程本地同步执行，不需要 Redis broker。

用法：
    python -m backend.desktop_start --port 8000
"""

import os
import sys
from pathlib import Path


def _bootstrap_env() -> None:
    """在导入任何 backend 模块之前加载 .env 并锁定桌面模式。"""
    project_root = Path(__file__).resolve().parent.parent

    # 加载 .env（若装了 python-dotenv）
    env_file = project_root / ".env"
    try:
        from dotenv import load_dotenv

        load_dotenv(env_file)
    except Exception:
        # 兜底：手动解析 KEY=VALUE
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    # 强制桌面模式（本地队列，无需 Redis）
    os.environ["AUTOCLIP_DESKTOP_MODE"] = "true"
    os.environ["AUTOCLIP_MODE"] = "desktop"

    # 数据目录默认落在项目内 data/
    os.environ.setdefault("AUTOCLIP_DATA_DIR", str(project_root / "data"))


_bootstrap_env()

import logging  # noqa: E402  （必须在 _bootstrap_env 之后导入）

from backend.app_factory import create_app  # noqa: E402

logger = logging.getLogger(__name__)

# 以桌面模式创建应用
app = create_app(mode="desktop")


def _parse_port(argv) -> int:
    port = 8000
    for i, arg in enumerate(argv):
        if arg == "--port" and i + 1 < len(argv):
            try:
                port = int(argv[i + 1])
            except ValueError:
                logger.error(f"无效的端口号: {argv[i + 1]}")
    return port


if __name__ == "__main__":
    import uvicorn

    port = _parse_port(sys.argv)
    logger.info(f"[desktop] 启动服务器，端口: {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
