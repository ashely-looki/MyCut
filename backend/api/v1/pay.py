"""
支付宝支付 API（电脑网站支付 · 会员按月）

接口：
- POST /pay/alipay/create           下单，返回自动提交的支付宝表单 HTML（需登录）
- POST /pay/alipay/notify           支付宝异步通知（无需登录，支付宝服务器 POST，表单编码）
- GET  /pay/orders/{out_trade_no}   查订单状态；仍 pending 时主动 query 支付宝兜底（需登录）
- GET  /pay/membership              当前用户会员状态（需登录）

发货判定（开会员）以「收到并验签通过的支付成功」为准，notify 和轮询兜底两条路都会走
grant_membership，且按 out_trade_no 幂等，不会重复加时长。
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.auth import require_user_id, get_current_user_id
from backend.core import alipay_client
from backend.core.config import get_alipay_config
from backend.models.order import Order, OrderStatus, UserMembership
from backend.schemas.order import (
    CreateOrderRequest, CreateOrderResponse, OrderStatusResponse, MembershipResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# 支付宝“支付成功”的两种交易状态
_PAID_STATUSES = {"TRADE_SUCCESS", "TRADE_FINISHED"}


def _gen_out_trade_no() -> str:
    """生成商户订单号：时间无关（用 uuid），保证唯一。"""
    return "MC" + uuid.uuid4().hex


def _grant_membership(db: Session, order: Order) -> None:
    """按订单发货：把订单置为已支付，并给用户累加会员时长。按 order 幂等。"""
    # 幂等：已支付过就不再处理
    if order.status == OrderStatus.PAID.value:
        return

    now = datetime.now(timezone.utc)
    months = int(order.membership_months or "1")

    membership = db.query(UserMembership).filter(UserMembership.user_id == order.user_id).first()
    if not membership:
        membership = UserMembership(user_id=order.user_id, expires_at=now)
        db.add(membership)

    # 从「现有到期时间」和「现在」中取较晚者往后加，避免过期后续费被吃掉
    base = membership.expires_at
    if base is None or base < now:
        base = now
    membership.expires_at = base + timedelta(days=30 * months)

    order.status = OrderStatus.PAID.value
    order.paid_at = now
    db.commit()
    logger.info("会员已发放 user=%s order=%s 到期=%s", order.user_id, order.out_trade_no, membership.expires_at)


@router.post("/alipay/create", response_model=CreateOrderResponse)
async def create_alipay_order(
    body: CreateOrderRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
):
    """创建会员订单并生成支付宝支付表单。"""
    cfg = get_alipay_config()
    if not cfg["enabled"]:
        raise HTTPException(status_code=503, detail="支付未开启，请联系管理员配置支付宝")

    # 金额：单价 × 月数（本期 months 固定 1）
    unit = Decimal(str(cfg["month_price"]))
    amount = (unit * body.months).quantize(Decimal("0.01"))
    out_trade_no = _gen_out_trade_no()
    subject = f"MyCut 会员 {body.months} 个月"

    order = Order(
        user_id=user_id,
        out_trade_no=out_trade_no,
        subject=subject,
        amount=amount,
        status=OrderStatus.PENDING.value,
        membership_months=str(body.months),
    )
    db.add(order)
    db.commit()

    try:
        form_html = alipay_client.build_page_pay_form(out_trade_no, amount, subject)
    except alipay_client.AlipayNotConfigured:
        raise HTTPException(status_code=503, detail="支付未开启")
    except Exception:
        logger.exception("生成支付宝支付表单失败 out_trade_no=%s", out_trade_no)
        raise HTTPException(status_code=500, detail="发起支付失败，请稍后重试")

    return CreateOrderResponse(out_trade_no=out_trade_no, pay_form_html=form_html, amount=str(amount))


@router.post("/alipay/notify")
async def alipay_notify(request: Request, db: Session = Depends(get_db)):
    """支付宝异步通知。验签 + 校验金额/订单 + 幂等发货，返回纯文本 success。"""
    form = await request.form()
    params = {k: str(v) for k, v in form.items()}

    # 1) 验签
    if not alipay_client.verify_notify(params):
        logger.warning("支付宝通知验签失败 params=%s", {k: params.get(k) for k in ("out_trade_no", "trade_status")})
        return Response(content="failure", media_type="text/plain")

    out_trade_no = params.get("out_trade_no")
    trade_status = params.get("trade_status")
    order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
    if not order:
        logger.warning("支付宝通知：找不到订单 %s", out_trade_no)
        return Response(content="failure", media_type="text/plain")

    # 2) 校验金额一致（防篡改）
    try:
        notify_amount = Decimal(params.get("total_amount", "0")).quantize(Decimal("0.01"))
    except Exception:  # noqa: BLE001
        notify_amount = Decimal("-1")
    if notify_amount != Decimal(order.amount).quantize(Decimal("0.01")):
        logger.warning("支付宝通知金额不符 order=%s 期望=%s 实际=%s", out_trade_no, order.amount, notify_amount)
        return Response(content="failure", media_type="text/plain")

    # 3) 支付成功 → 记支付宝交易号 + 发货（幂等）
    if trade_status in _PAID_STATUSES:
        order.alipay_trade_no = params.get("trade_no")
        _grant_membership(db, order)

    # 支付宝要求回 "success"（收到后不再重复通知）
    return Response(content="success", media_type="text/plain")


@router.get("/orders/{out_trade_no}", response_model=OrderStatusResponse)
async def get_order_status(
    out_trade_no: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
):
    """查订单状态。仍为 pending 时主动向支付宝查询兜底（无公网 notify 时也能发货）。"""
    order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
    if not order or order.user_id != user_id:
        raise HTTPException(status_code=404, detail="订单不存在")

    # 兜底：本地还没收到 notify，就主动问支付宝这笔付了没
    if order.status == OrderStatus.PENDING.value:
        try:
            resp = alipay_client.query_trade(out_trade_no)
        except alipay_client.AlipayNotConfigured:
            resp = None
        except Exception:  # noqa: BLE001
            logger.exception("轮询查询支付宝订单异常 %s", out_trade_no)
            resp = None
        if resp and resp.get("trade_status") in _PAID_STATUSES:
            # 校验金额后发货
            try:
                q_amount = Decimal(resp.get("total_amount", "0")).quantize(Decimal("0.01"))
            except Exception:  # noqa: BLE001
                q_amount = Decimal("-1")
            if q_amount == Decimal(order.amount).quantize(Decimal("0.01")):
                order.alipay_trade_no = resp.get("trade_no")
                _grant_membership(db, order)

    return OrderStatusResponse(
        out_trade_no=order.out_trade_no,
        status=order.status,
        amount=str(order.amount),
        paid_at=order.paid_at,
    )


@router.get("/membership", response_model=MembershipResponse)
async def get_membership(
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
):
    """当前用户会员状态。"""
    membership = db.query(UserMembership).filter(UserMembership.user_id == user_id).first()
    if not membership or not membership.expires_at:
        return MembershipResponse(is_member=False, expires_at=None)
    now = datetime.now(timezone.utc)
    # SQLite 存的 datetime 可能不带 tzinfo，补成 UTC 再比较
    expires = membership.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    return MembershipResponse(is_member=expires > now, expires_at=membership.expires_at)
