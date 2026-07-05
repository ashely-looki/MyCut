"""大纲/文案 API（阶段2）。

POST /api/v1/scripts/outline  —— 选题 → 大纲
POST /api/v1/scripts/script   —— 大纲 → 分镜文案
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...services.script_service import get_script_service
from ...services.script_repo import ScriptRepo

logger = logging.getLogger(__name__)

router = APIRouter()


def get_script_repo(db: Session = Depends(get_db)) -> ScriptRepo:
    return ScriptRepo(db)


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


# ============ 文案持久化（保存/列表/详情/更新/删除）============

class SavedScriptPayload(BaseModel):
    title: str = Field(..., description="选题标题")
    domain: Optional[str] = None
    angle: Optional[str] = None
    target_audience: Optional[str] = None
    keywords: List[str] = []
    outline: Optional[Outline] = None
    segments: List[Segment] = []
    style: Optional[str] = None
    est_duration: Optional[int] = None


def _payload_to_dict(p: SavedScriptPayload) -> Dict[str, Any]:
    return {
        "title": p.title,
        "domain": p.domain,
        "angle": p.angle,
        "target_audience": p.target_audience,
        "keywords": p.keywords,
        "outline": p.outline.model_dump() if p.outline else None,
        "segments": [s.model_dump() for s in p.segments],
        "style": p.style,
        "est_duration": p.est_duration,
    }


@router.post("")
async def save_script(payload: SavedScriptPayload, repo: ScriptRepo = Depends(get_script_repo)) -> Dict[str, Any]:
    """保存一篇文案。"""
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="title 不能为空")
    return repo.create(_payload_to_dict(payload))


@router.get("")
async def list_scripts(repo: ScriptRepo = Depends(get_script_repo)) -> List[Dict[str, Any]]:
    """我的文案列表（按更新时间倒序）。"""
    return repo.list()


@router.get("/{script_id}")
async def get_script(script_id: str, repo: ScriptRepo = Depends(get_script_repo)) -> Dict[str, Any]:
    """文案详情。"""
    s = repo.get(script_id)
    if not s:
        raise HTTPException(status_code=404, detail="文案不存在")
    return s


@router.put("/{script_id}")
async def update_script(script_id: str, payload: SavedScriptPayload, repo: ScriptRepo = Depends(get_script_repo)) -> Dict[str, Any]:
    """更新文案。"""
    s = repo.update(script_id, _payload_to_dict(payload))
    if not s:
        raise HTTPException(status_code=404, detail="文案不存在")
    return s


@router.delete("/{script_id}")
async def delete_script(script_id: str, repo: ScriptRepo = Depends(get_script_repo)) -> Dict[str, str]:
    """删除文案。"""
    if not repo.delete(script_id):
        raise HTTPException(status_code=404, detail="文案不存在")
    return {"message": "已删除", "id": script_id}
