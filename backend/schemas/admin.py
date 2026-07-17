"""
管理者后台相关 Pydantic schema。

后台数据全部来自本地 SQLite（projects / orders / user_memberships），按 user_id 聚合。
真实用户邮箱在 Supabase，本地不落库，故列表以 user_id 为准，邮箱字段可能为空。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class AdminOverview(BaseModel):
    """概览大盘统计。"""
    total_users: int = Field(description="有过任何数据（项目/订单/会员）的用户数")
    total_members: int = Field(description="当前有效会员数（未过期）")
    new_users_today: int = Field(description="今日新增用户数（按首个项目创建时间粗算）")
    total_projects: int = Field(description="全平台项目总数")
    processing_projects: int = Field(description="处理中的项目数")
    failed_projects: int = Field(description="失败的项目数")
    total_orders: int = Field(description="订单总数")
    paid_orders: int = Field(description="已支付订单数")
    total_revenue: str = Field(description="已支付订单累计金额（元）")
    revenue_today: str = Field(description="今日已支付金额（元）")


class AdminUserItem(BaseModel):
    """后台用户列表的一行（按 user_id 聚合的画像）。"""
    user_id: str
    is_member: bool = Field(description="是否有效会员")
    membership_expires_at: Optional[datetime] = Field(default=None, description="会员到期时间")
    project_count: int = Field(description="该用户的项目数")
    paid_order_count: int = Field(description="该用户的已支付订单数")
    total_paid: str = Field(description="该用户累计支付金额（元）")
    first_seen_at: Optional[datetime] = Field(default=None, description="首次出现时间（最早项目/订单）")


class AdminUserListResponse(BaseModel):
    items: List[AdminUserItem]
    total: int
    page: int
    page_size: int


class AdminOrderItem(BaseModel):
    """后台订单列表的一行。"""
    out_trade_no: str
    user_id: str
    subject: str
    amount: str
    status: str = Field(description="pending / paid / closed / failed")
    membership_months: str
    alipay_trade_no: Optional[str] = None
    created_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


class AdminOrderListResponse(BaseModel):
    items: List[AdminOrderItem]
    total: int
    page: int
    page_size: int


class GrantMembershipRequest(BaseModel):
    """管理员手动给某用户开通/延长会员（不走支付，用于兑换码/手动发货）。"""
    user_id: str = Field(description="目标用户ID（Supabase user id）")
    months: int = Field(ge=1, le=120, description="延长的月数（在现有到期时间之后累加）")
    note: Optional[str] = Field(default=None, max_length=200, description="备注（记在日志里）")


class GrantMembershipResponse(BaseModel):
    user_id: str
    is_member: bool
    expires_at: Optional[datetime] = None
