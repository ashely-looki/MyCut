"""自动成片 Celery 任务（Remotion 合成路线，旁路模块）。

镜像 backend/tasks/processing.py::process_video_pipeline 的任务体结构：
建 Task 行 → 渲染 → 成功/失败分别置 Task + Project 状态。
桌面模式下 DesktopAwareTask 自动在后台线程执行 .delay()，无需 Redis。
"""

import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from backend.core.celery_app import celery_app
from backend.core.database import SessionLocal
from backend.core.path_utils import get_project_output_directory, get_temp_directory
from backend.models.clip import Clip, ClipStatus
from backend.models.project import Project, ProjectStatus
from backend.models.task import Task, TaskStatus, TaskType
from backend.services import compose_service
from backend.services.script_repo import ScriptRepo
from backend.utils.tts import _probe_duration

logger = logging.getLogger(__name__)

# 同一项目同一时间只允许一次成片（防桌面模式并发重复派发撞库）
_active_compose_projects: set = set()
_active_compose_lock = threading.Lock()


@celery_app.task(bind=True, name='backend.tasks.compose.render_script_video')
def render_script_video(self, project_id: str, script_id: str, with_scene: bool = True) -> Dict[str, Any]:
    """
    根据保存的文案渲染一条成片，产物落项目 output/compose.mp4，并把项目置为完成。

    Args:
        project_id: 承载成片产物的项目 ID（调用方已创建）
        script_id: 文案 ID
        with_scene: 是否为每句生成信息动画（关掉则纯字幕）
    """
    task_id = self.request.id
    logger.info(f"开始自动成片: project={project_id} script={script_id} task={task_id}")

    with _active_compose_lock:
        if project_id in _active_compose_projects:
            logger.warning(f"项目 {project_id} 已有成片任务在跑，跳过重复 {task_id}")
            return {"success": False, "skipped": True, "project_id": project_id}
        _active_compose_projects.add(project_id)

    db = SessionLocal()
    task = Task(
        name="自动成片",
        description=f"文案 {script_id} → 配音 + 逐句字幕成片",
        task_type=TaskType.EXPORT,
        project_id=project_id,
        celery_task_id=task_id,
        status=TaskStatus.RUNNING,
        progress=0,
        current_step="初始化",
        total_steps=1,
    )
    try:
        db.add(task)
        db.commit()

        # 读文案
        script = ScriptRepo(db).get(script_id)
        if not script:
            raise ValueError(f"文案不存在: {script_id}")

        # 进度回调 → 写 Task 行（前端轮询 project/task 状态）
        def progress_cb(percent: int, message: str) -> None:
            try:
                task.progress = float(percent)
                task.current_step = message
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()

        # 工作目录（props.json 落临时区）与产物路径（落项目 output/）
        workdir = get_temp_directory() / f"compose-{project_id}"
        workdir.mkdir(parents=True, exist_ok=True)
        out_path = get_project_output_directory(project_id) / "compose.mp4"

        progress_cb(5, "准备中…")
        # with_video=None → compose 内部默认走实拍 + Remotion（用户点「生成视频」即得实拍成片，
        # 零额外操作）；Higgsfield 不可用或某句不适合实拍时自动回退信息动画，不中断。
        compose_service.compose(
            script, workdir, out_path, job_id=project_id,
            progress_cb=progress_cb, with_scene=with_scene, with_video=None,
        )

        # 成片时长（用于 Clip 记录）
        total_seconds = int(round(_probe_duration(out_path))) or 1

        # 把成片登记为一个 Clip，复用现有详情页 ClipCard 播放/下载
        clip = Clip(
            title=(script.get("title") or "成片").strip(),
            description="由文案自动成片（配音 + 逐句字幕）",
            status=ClipStatus.COMPLETED,
            start_time=0,
            end_time=total_seconds,
            duration=total_seconds,
            score=1.0,
            video_path=str(out_path),
            processing_step=6,
            project_id=project_id,
        )
        db.add(clip)

        # 成功：置 Task + Project 完成，登记 video_path
        task.status = TaskStatus.COMPLETED
        task.progress = 100
        task.current_step = "成片完成"
        task.result_data = {"video_path": str(out_path)}

        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            project.status = ProjectStatus.COMPLETED
            project.video_path = str(out_path)
            project.completed_at = datetime.utcnow()
            project.updated_at = datetime.utcnow()
        db.commit()

        logger.info(f"自动成片完成: {out_path}")
        return {"success": True, "project_id": project_id, "video_path": str(out_path)}

    except Exception as e:  # noqa: BLE001
        error_msg = f"自动成片失败: {e}"
        logger.error(error_msg, exc_info=True)
        try:
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = ProjectStatus.FAILED
                project.updated_at = datetime.utcnow()
            db.commit()
        except Exception:  # noqa: BLE001
            db.rollback()
        return {"success": False, "project_id": project_id, "error": str(e)}

    finally:
        db.close()
        with _active_compose_lock:
            _active_compose_projects.discard(project_id)
