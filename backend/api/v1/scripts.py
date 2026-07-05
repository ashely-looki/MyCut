"""大纲/文案 API（阶段2）。

POST /api/v1/scripts/outline  —— 选题 → 大纲
POST /api/v1/scripts/script   —— 大纲 → 分镜文案
"""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ...services.script_service import get_script_service

logger = logging.getLogger(__name__)

router = APIRouter()


class OutlineSection(BaseModel):
    point: str = ""
    detail: str = ""


class Outline(BaseModel):
    hook: str = ""
    sections: List[OutlineSection] = []
    cta: str = ""


class OutlineRequest(BaseModel):
    title: str = Field(..., description="选题标题")
    angle: str = ""
    target_audience: str = ""
    keywords: List[str] = []
    duration: int = Field(60, ge=10, le=600, description="目标时长(秒)")


class ScriptRequest(BaseModel):
    title: str = Field(..., description="选题标题")
    outline: Outline
    style: str = Field("干货", description="文案风格，如 干货/热血/亲和/犀利")
    duration: int = Field(60, ge=10, le=600)


class Segment(BaseModel):
    index: int
    role: str = "body"
    narration: str = ""
    visual: str = ""
    est_seconds: int = 0


@router.post("/outline", response_model=Outline)
async def create_outline(request: OutlineRequest) -> Dict[str, Any]:
    """选题 → 大纲。"""
    if not request.title.strip():
        raise HTTPException(status_code=400, detail="title 不能为空")
    try:
        service = get_script_service()
        outline = service.generate_outline(request.model_dump(), duration=request.duration)
        if not outline.get("hook") and not outline.get("sections"):
            raise HTTPException(status_code=502, detail="未能生成大纲，请重试")
        return outline
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("生成大纲失败")
        raise HTTPException(status_code=500, detail=f"生成大纲失败: {e}")


@router.post("/script", response_model=List[Segment])
async def create_script(request: ScriptRequest) -> List[Dict[str, Any]]:
    """大纲 → 分镜文案。"""
    try:
        service = get_script_service()
        segments = service.generate_script(
            title=request.title,
            outline=request.outline.model_dump(),
            style=request.style,
            duration=request.duration,
        )
        if not segments:
            raise HTTPException(status_code=502, detail="未能生成文案，请重试")
        return segments
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("生成文案失败")
        raise HTTPException(status_code=500, detail=f"生成文案失败: {e}")
