"""
订单 & 会员模型

- Order：一笔支付宝支付订单。金额、状态、支付宝流水号都在这里，发货以此为准。
- UserMembership：用户会员到期时间（按时长）。支付成功后在这里累加时长。

数据留本地 SQLite（与项目其它数据一致）。user_id 用 Supabase 的 user id。
"""

import enum
from sqlalchemy import Column, String, DateTime, Numeric, Index
from .base import BaseModel


class OrderStatus(str, enum.Enum):
    """订单状态。"""
    PENDING = "pending"      # 待支付（已创建，尚未收到支付宝支付成功）
    PAID = "paid"            # 已支付并已发货（开好会员）
    CLOSED = "closed"        # 已关闭/超时（本期不主动置，预留）
    FAILED = "failed"        # 处理失败（如验签过但金额/状态异常）


class Order(BaseModel):
    """支付订单。"""

    __tablename__ = "orders"

    # 归属用户（Supabase user id）
    user_id = Column(String(64), nullable=False, index=True, comment="下单用户ID")

    # 商户订单号：我们自己生成的唯一号，作为和支付宝对账的主键（out_trade_no）
    out_trade_no = Column(String(64), nullable=False, unique=True, index=True, comment="商户订单号")

    # 支付宝交易号：支付成功后由支付宝返回，用于对账/退款
    alipay_trade_no = Column(String(64), nullable=True, index=True, comment="支付宝交易号")

    subject = Column(String(256), nullable=False, comment="订单标题（收银台展示）")

    # 金额（元）。用 Numeric 存，避免浮点误差；与支付宝对账严格相等。
    amount = Column(Numeric(10, 2), nullable=False, comment="订单金额（元）")

    status = Column(String(16), nullable=False, default=OrderStatus.PENDING.value, index=True, comment="订单状态")

    # 该订单购买的会员月数（本期固定 1）
    membership_months = Column(String(8), nullable=False, default="1", comment="购买会员月数")

    paid_at = Column(DateTime(timezone=True), nullable=True, comment="支付成功时间")

    __table_args__ = (
        Index("ix_orders_user_status", "user_id", "status"),
    )

    def __repr__(self):
        return f"<Order(out_trade_no={self.out_trade_no}, status={self.status}, amount={self.amount})>"


class UserMembership(BaseModel):
    """用户会员状态（按时长）。一个用户一行，记会员到期时间。"""

    __tablename__ = "user_memberships"

    user_id = Column(String(64), nullable=False, unique=True, index=True, comment="用户ID")
    # 会员到期时间。为空或早于当前时间 = 非会员。
    expires_at = Column(DateTime(timezone=True), nullable=True, comment="会员到期时间")

    def __repr__(self):
        return f"<UserMembership(user_id={self.user_id}, expires_at={self.expires_at})>"
