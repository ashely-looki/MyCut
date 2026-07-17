"""
管理者后台 API（运营者视角，只读为主 + 手动发会员）

鉴权：所有接口都要过 `require_admin`（JWT 里的 email 命中 ADMIN_EMAILS 白名单）。
数据源：本地 SQLite（projects / orders / user_memberships），按 user_id 聚合。

接口（prefix /api/v1/admin）：
- GET  /overview            概览大盘统计
- GET  /users              用户列表（分页，可按 会员/user_id 过滤）
- GET  /orders             订单列表（分页，可按 状态/user_id 过滤）
- POST /memberships/grant  手动给某用户开通/延长会员（不走支付）
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.auth import (
    require_admin, AdminUser, _decode_supabase_jwt, _extract_email, is_admin_email,
)
from backend.models.project import Project, ProjectStatus
from backend.models.order import Order, OrderStatus, UserMembership
from backend.schemas.admin import (
    AdminOverview,
    AdminUserItem, AdminUserListResponse,
    AdminOrderItem, AdminOrderListResponse,
    GrantMembershipRequest, GrantMembershipResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

# auto_error=False：whoami 在没带 / 非法 token 时也不报错，直接回 is_admin=false，
# 让前端能安静地决定「后台入口」要不要显示，不触发全局错误提示。
_bearer_optional = HTTPBearer(auto_error=False)


@router.get("/whoami")
async def admin_whoami(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_optional),
):
    """判断当前调用者是不是管理员（不鉴权、不抛错，仅供前端决定入口是否显示）。"""
    if not credentials or not credentials.credentials:
        return {"is_admin": False, "email": None}
    try:
        payload = _decode_supabase_jwt(credentials.credentials)
    except Exception:  # noqa: BLE001 解析失败当作非管理员
        return {"is_admin": False, "email": None}
    email = _extract_email(payload)
    return {"is_admin": is_admin_email(email), "email": email}


def _as_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite 存的 datetime 可能不带 tzinfo，统一补成 UTC 便于比较。"""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _today_start_utc() -> datetime:
    """今天 0 点（UTC）。用于「今日新增/今日收入」的粗略统计。"""
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _money(value) -> str:
    """金额统一量化成两位小数字符串。"""
    return str(Decimal(str(value or 0)).quantize(Decimal("0.01")))


@router.get("/overview", response_model=AdminOverview)
async def get_overview(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_admin),
):
    """概览大盘：用户/会员/项目/订单/收入的汇总。"""
    now = datetime.now(timezone.utc)
    today = _today_start_utc()

    # ---- 用户数：出现在 projects / orders / user_memberships 里的不同 user_id ----
    user_ids = set()
    for (uid,) in db.query(Project.user_id).filter(Project.user_id.isnot(None)).distinct():
        user_ids.add(uid)
    for (uid,) in db.query(Order.user_id).distinct():
        user_ids.add(uid)
    for (uid,) in db.query(UserMembership.user_id).distinct():
        user_ids.add(uid)
    total_users = len(user_ids)

    # ---- 有效会员数：expires_at 晚于现在 ----
    total_members = 0
    for (expires,) in db.query(UserMembership.expires_at).filter(UserMembership.expires_at.isnot(None)):
        if _as_utc(expires) and _as_utc(expires) > now:
            total_members += 1

    # ---- 今日新增用户：首个项目创建时间在今天（粗算，本地无真实注册时间）----
    first_seen = (
        db.query(Project.user_id, func.min(Project.created_at))
        .filter(Project.user_id.isnot(None))
        .group_by(Project.user_id)
        .all()
    )
    new_users_today = sum(1 for _uid, first in first_seen if _as_utc(first) and _as_utc(first) >= today)

    # ---- 项目 ----
    total_projects = db.query(func.count(Project.id)).scalar() or 0
    processing_projects = (
        db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.PROCESSING).scalar() or 0
    )
    failed_projects = (
        db.query(func.count(Project.id)).filter(Project.status == ProjectStatus.FAILED).scalar() or 0
    )

    # ---- 订单 & 收入 ----
    total_orders = db.query(func.count(Order.id)).scalar() or 0
    paid_orders_q = db.query(Order).filter(Order.status == OrderStatus.PAID.value)
    paid_orders = paid_orders_q.count()

    total_revenue = Decimal("0.00")
    revenue_today = Decimal("0.00")
    for order in paid_orders_q.all():
        amt = Decimal(str(order.amount or 0))
        total_revenue += amt
        paid_at = _as_utc(order.paid_at)
        if paid_at and paid_at >= today:
            revenue_today += amt

    return AdminOverview(
        total_users=total_users,
        total_members=total_members,
        new_users_today=new_users_today,
        total_projects=total_projects,
        processing_projects=processing_projects,
        failed_projects=failed_projects,
        total_orders=total_orders,
        paid_orders=paid_orders,
        total_revenue=_money(total_revenue),
        revenue_today=_money(revenue_today),
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    only_members: bool = Query(False, description="只看有效会员"),
    q: Optional[str] = Query(None, description="按 user_id 模糊过滤"),
):
    """用户列表（按 user_id 聚合项目数 / 已支付订单 / 会员状态）。"""
    now = datetime.now(timezone.utc)

    # 汇总每个 user_id 的画像。数据量不大（单机/早期），内存聚合即可。
    profiles: dict = {}

    def _ensure(uid: str) -> dict:
        return profiles.setdefault(uid, {
            "user_id": uid,
            "project_count": 0,
            "paid_order_count": 0,
            "total_paid": Decimal("0.00"),
            "first_seen_at": None,
            "membership_expires_at": None,
        })

    def _touch_first_seen(p: dict, dt: Optional[datetime]):
        dt = _as_utc(dt)
        if dt and (p["first_seen_at"] is None or dt < p["first_seen_at"]):
            p["first_seen_at"] = dt

    # 项目：数量 + 最早创建时间
    for uid, cnt, first in (
        db.query(Project.user_id, func.count(Project.id), func.min(Project.created_at))
        .filter(Project.user_id.isnot(None))
        .group_by(Project.user_id)
        .all()
    ):
        p = _ensure(uid)
        p["project_count"] = cnt or 0
        _touch_first_seen(p, first)

    # 已支付订单：笔数 + 累计金额 + 最早下单时间
    for order in db.query(Order).all():
        p = _ensure(order.user_id)
        _touch_first_seen(p, order.created_at)
        if order.status == OrderStatus.PAID.value:
            p["paid_order_count"] += 1
            p["total_paid"] += Decimal(str(order.amount or 0))

    # 会员到期时间
    for uid, expires in db.query(UserMembership.user_id, UserMembership.expires_at).all():
        _ensure(uid)["membership_expires_at"] = _as_utc(expires)

    items = list(profiles.values())

    # 过滤
    if q:
        needle = q.strip().lower()
        items = [it for it in items if needle in it["user_id"].lower()]
    if only_members:
        items = [it for it in items if it["membership_expires_at"] and it["membership_expires_at"] > now]

    # 排序：最近出现的在前（first_seen_at 越晚越靠前，None 垫底）
    items.sort(key=lambda it: it["first_seen_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start:start + page_size]

    return AdminUserListResponse(
        items=[
            AdminUserItem(
                user_id=it["user_id"],
                is_member=bool(it["membership_expires_at"] and it["membership_expires_at"] > now),
                membership_expires_at=it["membership_expires_at"],
                project_count=it["project_count"],
                paid_order_count=it["paid_order_count"],
                total_paid=_money(it["total_paid"]),
                first_seen_at=it["first_seen_at"],
            )
            for it in page_items
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/orders", response_model=AdminOrderListResponse)
async def list_orders(
    db: Session = Depends(get_db),
    _admin: AdminUser = Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="按状态过滤：pending/paid/closed/failed"),
    user_id: Optional[str] = Query(None, description="按 user_id 过滤"),
):
    """订单/支付流水列表（分页，按下单时间倒序）。"""
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    if user_id:
        query = query.filter(Order.user_id == user_id)

    total = query.count()
    rows = (
        query.order_by(Order.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AdminOrderListResponse(
        items=[
            AdminOrderItem(
                out_trade_no=o.out_trade_no,
                user_id=o.user_id,
                subject=o.subject,
                amount=_money(o.amount),
                status=o.status,
                membership_months=o.membership_months,
                alipay_trade_no=o.alipay_trade_no,
                created_at=o.created_at,
                paid_at=o.paid_at,
            )
            for o in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/memberships/grant", response_model=GrantMembershipResponse)
async def grant_membership(
    body: GrantMembershipRequest,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(require_admin),
):
    """
    管理员手动给某用户开通/延长会员（不走支付）。

    用于兑换码 / 手动发货过渡（个人号无法接电脑网站支付时的补充手段）。
    时长在「现有到期时间与现在的较晚者」之后累加，避免过期后续期被吃掉——
    与支付发货 `_grant_membership` 的口径一致。
    """
    now = datetime.now(timezone.utc)

    membership = db.query(UserMembership).filter(UserMembership.user_id == body.user_id).first()
    if not membership:
        membership = UserMembership(user_id=body.user_id, expires_at=now)
        db.add(membership)

    base = _as_utc(membership.expires_at)
    if base is None or base < now:
        base = now
    membership.expires_at = base + timedelta(days=30 * body.months)
    db.commit()

    logger.info(
        "管理员手动发会员 admin=%s target=%s months=%s note=%s 到期=%s",
        admin.email, body.user_id, body.months, body.note, membership.expires_at,
    )

    expires = _as_utc(membership.expires_at)
    return GrantMembershipResponse(
        user_id=body.user_id,
        is_member=bool(expires and expires > now),
        expires_at=membership.expires_at,
    )
