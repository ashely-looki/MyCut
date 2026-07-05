"""热点选题服务（阶段1）。

流程：领域/关键词 → 联网搜索(Bing，可选) → LLM 归纳成结构化选题卡片。
- 有 Bing key：先检索再归纳，选题有据可依、带来源链接。
- 无 Bing key：跳过检索，让 LLM 基于领域常识生成选题（标注未联网校验）。

不落库，直接返回选题卡片列表（阶段2 接文案时再考虑持久化）。
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List

from ..utils.llm_client import LLMClient
from ..utils import web_search

logger = logging.getLogger(__name__)

# 热点归纳提示词（项目根目录 prompt/）
_PROMPT_PATH = Path(__file__).parent.parent.parent / "prompt" / "热点归纳.txt"

# 选题卡片字段（用于兜底补全，保证前端拿到统一结构）
_CARD_FIELDS = {
    "title": "",
    "angle": "",
    "why_hot": "",
    "target_audience": "",
    "keywords": [],
    "heat_score": 0.0,
    "sources": [],
}


class HotspotService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        try:
            self._prompt = _PROMPT_PATH.read_text(encoding="utf-8")
        except Exception as e:  # noqa: BLE001
            logger.error("加载热点归纳提示词失败(%s): %s", _PROMPT_PATH, e)
            self._prompt = "根据 domain/keywords 和 search_results 归纳选题，输出 JSON 数组。"

    def find_hotspots(
        self,
        domain: str,
        keywords: str = "",
        count: int = 5,
    ) -> Dict[str, Any]:
        """返回 {topics: [...], searched: bool, search_available: bool}。"""
        query = " ".join(x for x in [domain, keywords] if x).strip() or domain
        search_available = web_search.is_search_available()

        # 1. 联网检索（无 key 时返回空，走 LLM 兜底）
        hits = web_search.search(query, count=max(count * 2, 8)) if search_available else []
        searched = bool(hits)

        # 2. LLM 归纳成选题卡片
        input_data = {
            "domain": domain,
            "keywords": keywords,
            "count": count,
            "search_results": [h.to_dict() for h in hits],
        }
        try:
            response = self.llm.call_with_retry(self._prompt, input_data)
            topics = self._parse_topics(response)
        except Exception as e:  # noqa: BLE001
            logger.error("热点归纳 LLM 调用失败: %s", e)
            topics = []

        return {
            "topics": topics[:count],
            "searched": searched,
            "search_available": search_available,
            "query": query,
        }

    def _parse_topics(self, response: str) -> List[Dict[str, Any]]:
        """解析 LLM 返回的选题卡片数组，并补全缺失字段。"""
        try:
            parsed = self.llm.parse_json_response(response)
        except Exception as e:  # noqa: BLE001
            logger.error("解析热点选题 JSON 失败: %s", e)
            return []

        if isinstance(parsed, dict):
            # 容错：模型偶尔包一层 {"topics": [...]}
            parsed = parsed.get("topics") or parsed.get("data") or [parsed]
        if not isinstance(parsed, list):
            return []

        cards: List[Dict[str, Any]] = []
        for i, item in enumerate(parsed):
            if not isinstance(item, dict):
                continue
            card = {**_CARD_FIELDS, **item}
            card["id"] = str(i + 1)
            # 规整数组/数值类型
            if not isinstance(card.get("keywords"), list):
                card["keywords"] = []
            if not isinstance(card.get("sources"), list):
                card["sources"] = []
            try:
                card["heat_score"] = float(card.get("heat_score") or 0.0)
            except (TypeError, ValueError):
                card["heat_score"] = 0.0
            cards.append(card)
        return cards


_service: HotspotService | None = None


def get_hotspot_service() -> HotspotService:
    global _service
    if _service is None:
        _service = HotspotService()
    return _service
