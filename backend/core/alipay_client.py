"""
支付宝客户端封装（电脑网站支付 alipay.trade.page.pay）

职责：
1. build_page_pay_form() —— 生成一段自动提交的支付表单 HTML，前端塞进页面即跳转收银台。
2. verify_notify()       —— 校验异步通知(notify)的签名，防伪造。
3. query_trade()         —— 主动查询一笔订单在支付宝侧的状态（轮询兜底用）。

所有配置从 get_alipay_config() 读，未启用时抛错由上层接口转成 503/400。
"""

import logging
from decimal import Decimal
from typing import Any, Dict, Optional

from alipay.aop.api.AlipayClientConfig import AlipayClientConfig
from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient
from alipay.aop.api.domain.AlipayTradePagePayModel import AlipayTradePagePayModel
from alipay.aop.api.request.AlipayTradePagePayRequest import AlipayTradePagePayRequest
from alipay.aop.api.domain.AlipayTradeQueryModel import AlipayTradeQueryModel
from alipay.aop.api.request.AlipayTradeQueryRequest import AlipayTradeQueryRequest
from alipay.aop.api.util.SignatureUtils import verify_with_rsa

from .config import get_alipay_config

logger = logging.getLogger(__name__)


class AlipayNotConfigured(RuntimeError):
    """支付宝未启用/未配置齐全。"""


def _client_and_cfg():
    cfg = get_alipay_config()
    if not cfg["enabled"]:
        raise AlipayNotConfigured("支付宝支付未启用或配置不完整（APPID/应用私钥/支付宝公钥）")

    client_config = AlipayClientConfig()
    client_config.server_url = cfg["server_url"]
    client_config.app_id = cfg["app_id"]
    client_config.app_private_key = cfg["app_private_key"]
    client_config.alipay_public_key = cfg["alipay_public_key"]
    client_config.sign_type = cfg["sign_type"]
    return DefaultAlipayClient(alipay_client_config=client_config, logger=logger), cfg


def build_page_pay_form(out_trade_no: str, total_amount: Decimal, subject: str) -> str:
    """生成电脑网站支付的自动提交表单 HTML（POST 到支付宝网关）。"""
    client, cfg = _client_and_cfg()

    model = AlipayTradePagePayModel()
    model.out_trade_no = out_trade_no
    model.total_amount = str(total_amount)   # 金额字符串，两位小数
    model.subject = subject
    model.product_code = "FAST_INSTANT_TRADE_PAY"  # 电脑网站支付固定值

    request = AlipayTradePagePayRequest(biz_model=model)
    if cfg["notify_url"]:
        request.notify_url = cfg["notify_url"]
    if cfg["return_url"]:
        request.return_url = cfg["return_url"]

    # http_method=POST → 返回一段带自动提交脚本的 form HTML
    return client.page_execute(request, http_method="POST")


def verify_notify(params: Dict[str, str]) -> bool:
    """校验支付宝异步通知签名。

    规则（支付宝标准）：除 sign、sign_type 外的参数，按 key 字典序排序后
    以 k=v&k=v 拼成待验字符串，用支付宝公钥对 sign 做 RSA2 验签。
    """
    cfg = get_alipay_config()
    if not cfg["enabled"]:
        raise AlipayNotConfigured("支付宝支付未启用")

    sign = params.get("sign")
    if not sign:
        return False

    # 排除 sign / sign_type，其余按 key 排序拼接
    items = sorted((k, v) for k, v in params.items() if k not in ("sign", "sign_type") and v is not None)
    message = "&".join(f"{k}={v}" for k, v in items)

    try:
        return bool(verify_with_rsa(cfg["alipay_public_key"], message.encode("utf-8"), sign))
    except Exception as e:  # noqa: BLE001 验签任何异常都视为不通过
        logger.warning("支付宝通知验签异常: %s", e)
        return False


def query_trade(out_trade_no: str) -> Optional[Dict[str, Any]]:
    """按商户订单号查询支付宝侧交易状态。

    返回字典（含 trade_status / trade_no / total_amount 等），查询失败或无此单返回 None。
    trade_status: WAIT_BUYER_PAY / TRADE_SUCCESS / TRADE_FINISHED / TRADE_CLOSED
    """
    client, _cfg = _client_and_cfg()

    model = AlipayTradeQueryModel()
    model.out_trade_no = out_trade_no
    request = AlipayTradeQueryRequest(biz_model=model)

    try:
        content = client.execute(request)
    except Exception as e:  # noqa: BLE001
        logger.warning("查询支付宝订单失败 out_trade_no=%s: %s", out_trade_no, e)
        return None

    import json
    try:
        data = json.loads(content) if isinstance(content, (str, bytes)) else content
    except (ValueError, TypeError):
        logger.warning("解析支付宝查询响应失败: %r", content)
        return None

    # SDK 返回的是业务响应体（alipay_trade_query_response 的内容）
    resp = data.get("alipay_trade_query_response", data) if isinstance(data, dict) else {}
    if resp.get("code") == "10000":
        return resp
    # code=40004 且 sub_code=ACQ.TRADE_NOT_EXIST → 订单还没被支付宝创建（用户没进收银台）
    logger.info("支付宝订单查询未成功 out_trade_no=%s resp=%s", out_trade_no, resp)
    return None
