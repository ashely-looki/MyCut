"""可插拔联网搜索适配层。

阶段1 用于「AI 查热点」：先联网检索，再交给 LLM 归纳成选题卡片。

设计：
- provider 由环境变量 SEARCH_PROVIDER 决定（默认 bing）。
- Bing 需要 BING_SEARCH_KEY（Azure Bing Web Search v7）。
- 没有 key 时不报错，返回空结果并标记 available=False，
  上层 hotspot_service 会降级为「纯 LLM 生成选题」。
- 结构预留其它 provider（serper/tavily），保持统一返回格式便于替换。

统一返回：List[SearchHit]，每条 {title, snippet, url, source}。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, asdict
from typing import List

logger = logging.getLogger(__name__)

# Bing Web Search v7 端点（Azure 认知服务）
BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"


@dataclass
class SearchHit:
    title: str
    snippet: str
    url: str = ""
    source: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


def _get_search_config() -> tuple[str, str]:
    """返回 (provider, api_key)。key 可能为空。"""
    provider = (os.getenv("SEARCH_PROVIDER") or "bing").strip().lower()
    key = ""
    if provider == "bing":
        key = os.getenv("BING_SEARCH_KEY", "").strip()
    return provider, key


def is_search_available() -> bool:
    """当前是否配置了可用的联网搜索。"""
    provider, key = _get_search_config()
    return bool(key)


def search(query: str, count: int = 10, market: str = "zh-CN") -> List[SearchHit]:
    """执行联网搜索。无 key / 出错时返回空列表（由上层降级处理）。

    Args:
        query: 检索词
        count: 返回条数上限
        market: 地区/语言市场，默认简体中文
    """
    provider, key = _get_search_config()

    if not key:
        logger.info("未配置联网搜索 key（%s），跳过检索，交由 LLM 兜底生成选题", provider)
        return []

    if provider == "bing":
        return _bing_search(query, count, market, key)

    logger.warning("暂不支持的搜索 provider: %s，跳过检索", provider)
    return []


def _bing_search(query: str, count: int, market: str, key: str) -> List[SearchHit]:
    """调用 Bing Web Search v7。"""
    try:
        import requests

        headers = {"Ocp-Apim-Subscription-Key": key}
        params = {
            "q": query,
            "count": max(1, min(count, 50)),
            "mkt": market,
            "textDecorations": False,
            "responseFilter": "Webpages,News",
        }
        resp = requests.get(BING_ENDPOINT, headers=headers, params=params, timeout=20)
        if resp.status_code != 200:
            logger.error("Bing 搜索失败 status=%s body=%s", resp.status_code, resp.text[:200])
            return []

        data = resp.json()
        hits: List[SearchHit] = []

        # 网页结果
        for item in (data.get("webPages", {}) or {}).get("value", []):
            hits.append(SearchHit(
                title=item.get("name", ""),
                snippet=item.get("snippet", ""),
                url=item.get("url", ""),
                source=item.get("siteName") or "web",
            ))

        # 新闻结果（热点更相关）
        for item in (data.get("news", {}) or {}).get("value", []):
            hits.append(SearchHit(
                title=item.get("name", ""),
                snippet=item.get("description", ""),
                url=item.get("url", ""),
                source=(item.get("provider") or [{}])[0].get("name", "news")
                if item.get("provider") else "news",
            ))

        logger.info("Bing 搜索『%s』返回 %d 条", query, len(hits))
        return hits[:count]

    except Exception as e:  # noqa: BLE001
        logger.error("Bing 搜索异常: %s", e)
        return []
