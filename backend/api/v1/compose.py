"""自动成片 API（Remotion 合成路线，旁路模块）。

POST /api/v1/compose/from-script  —— 保存的文案 → 配音 + 逐句字幕成片
GET  /api/v1/compose/ready        —— Remotion / TTS 依赖是否就绪
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.project import ProjectCreate
from ...models.project import ProjectStatus, ProjectType
from ...services.project_service import ProjectService
from ...services.script_repo import ScriptRepo
from ...services import compose_service
from ...utils import tts

logger = logging.getLogger(__name__)

router = APIRouter()


class ComposeFromScriptRequest(BaseModel):
    script_id: str
    with_scene: bool = True  # 是否为每句生成信息动画（关掉则纯字幕）


class ComposeFromScriptResponse(BaseModel):
    project_id: str
    message: str


@router.get("/ready")
def compose_ready() -> dict:
    """自动成片依赖是否就绪（Remotion node_modules + edge-tts）。"""
    remotion_ok = compose_service.is_ready()
    tts_ok = tts.is_available()
    return {
        "ready": remotion_ok and tts_ok,
        "remotion": remotion_ok,
        "tts": tts_ok,
        "hint": None if (remotion_ok and tts_ok) else
                "自动成片需要 Remotion（在 remotion/ 执行 npm install）和 edge-tts（pip install edge-tts）。",
    }


@router.post("/from-script", response_model=ComposeFromScriptResponse)
def compose_from_script(
    req: ComposeFromScriptRequest,
    db: Session = Depends(get_db),
) -> ComposeFromScriptResponse:
    """根据保存的文案启动自动成片，返回承载产物的项目 ID。"""
    # 依赖预检——未就绪就别建项目，直接给友好提示
    if not compose_service.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Remotion 未安装依赖。请在 remotion/ 目录执行 npm install 后重试。",
        )
    if not tts.is_available():
        raise HTTPException(
            status_code=503,
            detail="edge-tts 未安装。请 pip install edge-tts 后重试。",
        )

    script = ScriptRepo(db).get(req.script_id)
    if not script:
        raise HTTPException(status_code=404, detail="文案不存在")

    title = (script.get("title") or "未命名文案").strip()

    # 创建承载成片的项目（复用现有项目库展示）
    project_service = ProjectService(db)
    project_data = ProjectCreate(
        name=f"成片：{title}",
        description=f"由文案「{title}」自动成片（配音 + 逐句字幕）",
        project_type=ProjectType.KNOWLEDGE,
        status=ProjectStatus.PENDING,
        source_url=None,
        source_file=None,
        settings={"compose": True, "script_id": req.script_id},
    )
    project = project_service.create_project(project_data)
    project_id = str(project.id)

    # 派发渲染任务（桌面模式自动后台线程执行）
    from ...tasks.compose import render_script_video
    render_script_video.delay(project_id=project_id, script_id=req.script_id, with_scene=req.with_scene)

    logger.info(f"已启动自动成片: project={project_id} script={req.script_id}")
    return ComposeFromScriptResponse(project_id=project_id, message="已开始生成视频")
