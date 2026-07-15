"""
迁移：创建 orders 和 user_memberships 两张表。

这两张是全新表，Base.metadata.create_all（后端启动时会跑）本就会创建它们，
所以正常启动一次即可。这个脚本提供一个显式、幂等的建表入口，便于手动执行/排查。

用法（项目根目录）：
    source venv/bin/activate
    export PYTHONPATH="${PWD}:${PYTHONPATH}"
    python -m backend.migrate_add_orders
"""

import logging

from sqlalchemy import inspect

from backend.core.database import engine
from backend.models.base import Base
# 导入模型以触发注册（Order / UserMembership）
from backend.models.order import Order, UserMembership  # noqa: F401

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("migrate_add_orders")


def main() -> None:
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())
    targets = {"orders": Order, "user_memberships": UserMembership}

    to_create = [name for name in targets if name not in existing]
    if not to_create:
        logger.info("orders / user_memberships 均已存在，无需迁移。")
        return

    # 只建目标表（checkfirst=True 幂等，不会动已有表）
    tables = [targets[name].__table__ for name in to_create]
    Base.metadata.create_all(bind=engine, tables=tables, checkfirst=True)
    logger.info("已创建表：%s", ", ".join(to_create))


if __name__ == "__main__":
    main()
