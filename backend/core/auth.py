"""
Supabase 认证依赖

前端用 Supabase JS 登录后，会在请求头带上
`Authorization: Bearer <access_token>`。这里校验该 token，成功后取出 `sub`
作为真实 user_id。

签名算法两种都支持（新版 Supabase 默认非对称）：
- 非对称 ES256/RS256：用项目的 JWKS 公钥端点验签（自动拉公钥、按 kid 匹配）。
  这是首选，新版 Supabase 用户 token 就是这种。
- 对称 HS256：用项目 JWT secret 验签，作为老项目/回退。

设计要点：
- 不信任前端自报的 user_id，只信任校验通过的 JWT 里的 sub。
- `AUTH_ENABLED=false`（或未配置认证）时降级为「不强制登录」，拿不到 token
  就返回 None——用于本地调试和老数据兼容。
"""

import logging
import ssl
from typing import Optional

import certifi
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_supabase_config, get_admin_emails

logger = logging.getLogger(__name__)

# auto_error=False：没带 token 时不直接 401，交给下面的逻辑按 auth_enabled 决定
_bearer = HTTPBearer(auto_error=False)

# JWKS 客户端缓存（按 URL），避免每次请求都去拉公钥。PyJWKClient 自带公钥缓存。
_jwks_clients: dict = {}
# 用 certifi 的根证书建 SSL 上下文：macOS 上 Python 默认找不到系统根证书，
# 拉 JWKS 的 HTTPS 会报 CERTIFICATE_VERIFY_FAILED，这里显式提供 CA。
_ssl_ctx = ssl.create_default_context(cafile=certifi.where())


def _get_jwks_client(supabase_url: str) -> PyJWKClient:
    url = supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    client = _jwks_clients.get(url)
    if client is None:
        client = PyJWKClient(url, ssl_context=_ssl_ctx)
        _jwks_clients[url] = client
    return client


def _decode_supabase_jwt(token: str) -> dict:
    """校验并解码 Supabase JWT，失败抛 401。

    先看 token 头部的 alg：非对称走 JWKS 公钥验签，HS256 走 secret。
    """
    cfg = get_supabase_config()
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")

        if alg.startswith(("ES", "RS", "PS")):
            # 非对称：用 JWKS 公钥验签
            if not cfg["url"]:
                raise jwt.InvalidTokenError("未配置 SUPABASE_URL，无法用 JWKS 验签")
            signing_key = _get_jwks_client(cfg["url"]).get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
        else:
            # 对称 HS256：用 JWT secret
            if not cfg["jwt_secret"]:
                raise jwt.InvalidTokenError("未配置 SUPABASE_JWT_SECRET，无法用 HS256 验签")
            payload = jwt.decode(
                token,
                cfg["jwt_secret"],
                algorithms=["HS256"],
                audience="authenticated",
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已过期，请重新登录",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning("JWT 校验失败: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的登录凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:  # noqa: BLE001 JWKS 拉取等网络异常也视为验签失败
        logger.warning("JWT 验签异常（可能 JWKS 拉取失败）: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的登录凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[str]:
    """
    返回当前登录用户的 id（Supabase user 的 sub / uuid）。

    - auth_enabled 且带了合法 token → 返回 user_id
    - auth_enabled 但没带 / token 非法 → 401
    - auth 未启用 → 返回 None（不强制登录，兼容老数据/本地调试）
    """
    cfg = get_supabase_config()

    if not cfg["auth_enabled"]:
        # 未开启认证：有 token 就尽力解析（不报错），没有就放行为匿名
        if credentials and credentials.credentials:
            try:
                payload = _decode_supabase_jwt(credentials.credentials)
                return payload.get("sub")
            except HTTPException:
                return None
        return None

    # 已开启认证：必须带合法 token
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证缺少用户标识",
        )
    return user_id


def require_user_id(
    user_id: Optional[str] = Depends(get_current_user_id),
) -> str:
    """
    强制要求登录的依赖：拿不到 user_id 就 401。
    用于「必须归属到某个用户」的写操作（如创建项目）。
    auth 未启用时返回一个固定的本地用户 id，保证老数据仍可写。
    """
    if user_id:
        return user_id
    cfg = get_supabase_config()
    if not cfg["auth_enabled"]:
        # 未开启认证的本地模式：所有数据归属到同一个「本地用户」
        return LOCAL_USER_ID
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="需要登录",
        headers={"WWW-Authenticate": "Bearer"},
    )


# 未开启认证时使用的占位用户 id（保证 user_id 列非空、且可跨会话稳定）
LOCAL_USER_ID = "local-single-user"


def _extract_email(payload: dict) -> Optional[str]:
    """从 Supabase JWT 里取邮箱。顶层有 email；也兜底看 user_metadata。"""
    email = payload.get("email")
    if not email:
        meta = payload.get("user_metadata") or {}
        email = meta.get("email")
    return email.strip().lower() if isinstance(email, str) else None


class AdminUser:
    """通过管理员校验的用户身份（user_id + email）。"""

    def __init__(self, user_id: str, email: str):
        self.user_id = user_id
        self.email = email


def require_admin(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AdminUser:
    """
    管理者后台的鉴权依赖：必须带合法 token，且 token 里的 email 命中 ADMIN_EMAILS 白名单。

    - 白名单为空 → 一律 403（没有配置管理员时，后台接口默认全关，最安全）。
    - 未带 token / token 非法 → 401。
    - 已登录但邮箱不在白名单 → 403。

    注意：这里独立于 AUTH_ENABLED。哪怕面向用户的登录门没开，只要配了
    SUPABASE_URL / SUPABASE_JWT_SECRET 能验签 token，管理员就能凭合法 token 进后台。
    """
    admins = get_admin_emails()
    if not admins:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="后台未开放")

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="需要登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_supabase_jwt(credentials.credentials)
    user_id = payload.get("sub")
    email = _extract_email(payload)
    if not user_id or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录凭证缺少用户信息")
    if email not in admins:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="没有后台权限")
    return AdminUser(user_id=user_id, email=email)


def is_admin_email(email: Optional[str]) -> bool:
    """判断某邮箱是否是管理员（供只读判断用，不做鉴权）。"""
    if not isinstance(email, str):
        return False
    return email.strip().lower() in get_admin_emails()
