"""热点选题 API（阶段1）。

POST /api/v1/hotspots/search  —— 输入领域/关键词，返回 AI 归纳的选题卡片。
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...services.hotspot_service import get_hotspot_service

logger = logging.getLogger(__name__)

router = APIRouter()


class HotspotSearchRequest(BaseModel):
    domain: str = Field(..., description="领域方向，如『AI工具/副业赚钱』")
    keywords: str = Field("", description="补充关键词，逗号分隔")
    count: int = Field(5, ge=1, le=15, description="希望产出的选题数量")


class TopicCard(BaseModel):
    id: str
    title: str
    angle: str = ""
    why_hot: str = ""
    target_audience: str = ""
    keywords: List[str] = []
    heat_score: float = 0.0
    sources: List[str] = []


class HotspotSearchResponse(BaseModel):
    topics: List[TopicCard]
    searched: bool
    search_available: bool
    query: str


@router.post("/search", response_model=HotspotSearchResponse)
async def search_hotspots(request: HotspotSearchRequest) -> Dict[str, Any]:
    """联网查热点 + AI 归纳选题卡片。无 Bing key 时降级为纯 LLM 生成。"""
    if not request.domain.strip():
        raise HTTPException(status_code=400, detail="domain 不能为空")
    try:
        service = get_hotspot_service()
        result = service.find_hotspots(
            domain=request.domain.strip(),
            keywords=request.keywords.strip(),
            count=request.count,
        )
        if not result["topics"]:
            raise HTTPException(status_code=502, detail="未能生成选题，请检查 LLM 配置或稍后重试")
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("查热点失败")
        raise HTTPException(status_code=500, detail=f"查热点失败: {e}")
