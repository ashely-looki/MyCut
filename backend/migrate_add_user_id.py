"""
轻量迁移：给 projects 表补上 user_id 列。

背景：项目用 SQLAlchemy 的 `Base.metadata.create_all` 建表，它只会创建「缺失的表」，
不会给「已存在的表」加新列。因此已经跑过的本地 SQLite（data/autoclip.db）需要手动补列。

用法（在项目根目录）：
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH}"
    python -m backend.migrate_add_user_id

幂等：列已存在时直接跳过。老项目的 user_id 会置为 LOCAL_USER_ID，
这样开启认证前的数据仍归属到「本地用户」，不会因过滤而丢失。
"""

import logging

from sqlalchemy import inspect, text

from backend.core.database import engine
from backend.core.auth import LOCAL_USER_ID

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("migrate_add_user_id")


def column_exists(table: str, column: str) -> bool:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return False
    return any(col["name"] == column for col in inspector.get_columns(table))


def main() -> None:
    if column_exists("projects", "user_id"):
        logger.info("projects.user_id 已存在，无需迁移。")
        return

    logger.info("正在给 projects 表添加 user_id 列 ...")
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(64)"))
        # 老项目归属到本地用户，避免开启认证后被过滤掉
        conn.execute(
            text("UPDATE projects SET user_id = :uid WHERE user_id IS NULL"),
            {"uid": LOCAL_USER_ID},
        )
        # 建索引（SQLite 支持 IF NOT EXISTS）
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_projects_user_id ON projects (user_id)")
        )
    logger.info("迁移完成：projects.user_id 已添加，老项目已归属到 %s。", LOCAL_USER_ID)


if __name__ == "__main__":
    main()
