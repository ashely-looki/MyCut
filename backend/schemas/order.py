"""
订单 / 会员相关 Pydantic schema。
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateOrderRequest(BaseModel):
    """创建会员支付订单的请求。本期只有月会员一个套餐，months 固定 1。"""
    months: int = Field(default=1, ge=1, le=12, description="购买会员月数")


class CreateOrderResponse(BaseModel):
    """创建订单响应：返回自动提交的支付宝表单 HTML + 商户订单号。"""
    out_trade_no: str = Field(description="商户订单号")
    pay_form_html: str = Field(description="自动提交到支付宝的表单HTML")
    amount: str = Field(description="订单金额（元）")


class OrderStatusResponse(BaseModel):
    """订单状态（前端轮询用）。"""
    out_trade_no: str
    status: str = Field(description="pending / paid / closed / failed")
    amount: str
    paid_at: Optional[datetime] = None


class MembershipResponse(BaseModel):
    """当前用户会员状态。"""
    is_member: bool = Field(description="是否会员（未过期）")
    expires_at: Optional[datetime] = Field(default=None, description="会员到期时间")
