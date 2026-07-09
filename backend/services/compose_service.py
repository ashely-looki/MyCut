"""
自动成片服务（Remotion 合成路线，旁路模块，不碰 step1~6 切片）。

流程：保存的文案 segments → 每句 TTS 配音（edge-tts）→ 用 ffprobe 测时长排布字幕
→ 组 Remotion inputProps → 调 `npx remotion render` 渲染出 MP4。

设为可选：remotion/node_modules 未安装时抛 ComposeNotReady，不影响主系统。
"""

import json
import logging
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from ..core.path_utils import get_project_root
from ..utils.ffmpeg_utils import get_npx_path
from ..utils import tts
from .scene_service import get_scene_service
from .theme_service import get_theme_service, DEFAULT_THEME

logger = logging.getLogger(__name__)

FPS = 30
TITLE_SECONDS = 2.5
OUTRO_SECONDS = 2.0
# 单句无配音时的兜底停留（秒），保证纯字幕也能看清
FALLBACK_SECONDS_PER_SENTENCE = 3.0
# 渲染超时（秒）——避免 Node 卡死 wedge 后台线程
RENDER_TIMEOUT = 900

# 画面主题不再写死：由 theme_service 按每条视频内容调性生成（见 build_props）。
# 默认主题（LLM 失败时回退）在 theme_service.DEFAULT_THEME。

# 中文分句：在句末标点后切分，保留标点
_SENTENCE_SPLIT = re.compile(r"(?<=[。！？；!?;])")

ProgressCb = Optional[Callable[[int, str], None]]


class ComposeNotReady(RuntimeError):
    """Remotion 工程未安装依赖（可选模块未就绪）。"""


def get_remotion_dir() -> Path:
    """remotion/ 工程目录（工程根下）。"""
    return get_project_root() / "remotion"


def get_public_job_dir(job_id: str) -> Path:
    """
    某次成片的音频存放目录。Remotion 的 <Audio> 只能加载 http(s) 或 public/ 下的
    staticFile 资源（不能用 file://），所以配音必须落在 remotion/public/ 里，
    组件侧用 staticFile('compose/<job_id>/xxx.mp3') 引用。
    （信息动画走结构化 scene，不落文件，无需 public 目录。）
    """
    return get_remotion_dir() / "public" / "compose" / job_id


def cleanup_public_job_dir(job_id: str) -> None:
    """渲染结束后清理 public 下该次成片的音频（避免堆积）。"""
    d = get_public_job_dir(job_id)
    try:
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"清理 compose public 目录失败 {d}: {e}")


def is_ready() -> bool:
    """Remotion 依赖是否已安装（node_modules 存在）。"""
    return (get_remotion_dir() / "node_modules").exists()


def split_sentences(narration: str) -> List[str]:
    """把一段口播按中文句末标点拆成句子列表。"""
    text = (narration or "").strip()
    if not text:
        return []
    parts = [p.strip() for p in _SENTENCE_SPLIT.split(text)]
    return [p for p in parts if p]


def _seconds_to_frames(seconds: float) -> int:
    return max(1, round(seconds * FPS))


def build_props(
    script: Dict[str, Any],
    workdir: Path,
    job_id: str,
    progress_cb: ProgressCb = None,
    with_scene: bool = True,
) -> Dict[str, Any]:
    """
    从文案 dict 构建 Remotion inputProps。
    每句 narration →
      1) edge-tts 配音（落 remotion/public/compose/<job_id>/），拿到真实时长
      2) with_scene 时调 LLM 把这句解析成「视觉脚本」scene（信息动画：关键词/图标/步骤/箭头/对比）

    Args:
        script: ScriptRepo.get() 返回的 dict（含 title / segments / style）
        workdir: 本次成片的工作目录（props.json 落这里）
        job_id: 本次成片标识（用作 public 子目录名，通常是 project_id）
        progress_cb: 可选进度回调 (percent:int, message:str)
        with_scene: 是否为每句生成信息动画 scene（关掉则上区留暖底，纯字幕）

    Returns:
        Remotion inputProps dict（audioSrc 为 staticFile 相对路径；scene 为结构化视觉脚本）
    """
    if not tts.is_available():
        raise ComposeNotReady("edge-tts 未安装，无法生成配音。请 pip install edge-tts。")

    # 音频必须落在 remotion/public/ 下（Remotion 只认 http(s) 或 staticFile）
    public_dir = get_public_job_dir(job_id)
    public_dir.mkdir(parents=True, exist_ok=True)

    title = (script.get("title") or "未命名").strip()
    style = (script.get("style") or "").strip()
    segments = script.get("segments") or []

    # 展平成 (句子, 角色) 列表，同时记录总句数用于进度
    sentence_items: List[tuple] = []
    for seg in segments:
        role = seg.get("role", "body")
        for sentence in split_sentences(seg.get("narration", "")):
            sentence_items.append((sentence, role))
    total_sentences = len(sentence_items)
    if total_sentences == 0:
        raise ValueError("文案没有可用的口播内容（narration 为空）。")

    # 整条视频挑一套贴内容调性的主题配色（只调一次 LLM；失败回退 DESIGN 默认主题）。
    # 取开头一句做 sample，帮 LLM 感受调性。
    if progress_cb:
        progress_cb(8, "为视频定调色…")
    try:
        theme = get_theme_service().build_theme(
            title=title,
            domain=(script.get("domain") or "").strip(),
            style=style,
            sample=sentence_items[0][0] if sentence_items else "",
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"主题生成异常，回退默认: {e}")
        theme = dict(DEFAULT_THEME)

    scene_service = get_scene_service() if with_scene else None
    out_segments: List[Dict[str, Any]] = []

    for idx, (sentence, role) in enumerate(sentence_items):
        # 1) 配音（先拿到真实时长，供 scene enterAt 落界）
        audio_name = f"{idx:03d}.mp3"
        audio_path = public_dir / audio_name
        seconds = 0.0
        try:
            seconds = tts.synthesize(sentence, audio_path)
        except tts.TTSNotAvailable:
            raise
        except Exception as e:  # noqa: BLE001
            logger.warning(f"第 {idx} 句 TTS 失败，改用无配音兜底: {e}")

        has_audio = seconds > 0 and audio_path.exists()
        if not has_audio:
            seconds = FALLBACK_SECONDS_PER_SENTENCE

        # 2) 视觉脚本（信息动画）
        scene = None
        if scene_service is not None:
            if progress_cb:
                pct = 10 + int(idx / total_sentences * 50)
                progress_cb(pct, f"设计画面中 {idx + 1}/{total_sentences}")
            scene = scene_service.build_scene(sentence, seconds, role=role, context_title=title)

        out_segments.append({
            "text": sentence,
            "audioSrc": f"compose/{job_id}/{audio_name}" if has_audio else None,
            "scene": scene,  # 视觉脚本；关掉 with_scene 时为 None（上区留暖底）
            "durationInFrames": _seconds_to_frames(seconds),
            "role": role,
        })

        if progress_cb:
            pct = 10 + int((idx + 1) / total_sentences * 50)
            progress_cb(pct, f"配音+画面 {idx + 1}/{total_sentences}")

    props = {
        "title": title,
        "style": style or None,
        "theme": theme,
        "titleDurationInFrames": _seconds_to_frames(TITLE_SECONDS),
        "outroDurationInFrames": _seconds_to_frames(OUTRO_SECONDS),
        "segments": out_segments,
    }

    props_path = workdir / "props.json"
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)
    logger.info(f"已写 Remotion props: {props_path}（{len(out_segments)} 句, 信息动画={with_scene}）")

    return props


def render(workdir: Path, out_path: Path, progress_cb: ProgressCb = None) -> None:
    """
    调 Remotion CLI 渲染 workdir/props.json → out_path（MP4）。
    流式读子进程输出、推进度；带超时避免卡死。
    """
    if not is_ready():
        raise ComposeNotReady(
            "Remotion 未安装依赖。请在 remotion/ 目录执行 npm install 后重试。"
        )

    remotion_dir = get_remotion_dir()
    props_path = workdir / "props.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        get_npx_path(), "remotion", "render",
        "src/index.ts", "CaptionedVideo",
        str(out_path.resolve()),
        f"--props={props_path.resolve()}",
    ]
    logger.info(f"开始 Remotion 渲染: {' '.join(cmd)} (cwd={remotion_dir})")

    try:
        proc = subprocess.Popen(
            cmd,
            cwd=str(remotion_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except FileNotFoundError as e:
        raise ComposeNotReady(f"找不到 npx（Node 环境）: {e}") from e

    lines: List[str] = []
    render_re = re.compile(r"Rendered\s+(\d+)/(\d+)")
    try:
        assert proc.stdout is not None
        for line in iter(proc.stdout.readline, ""):
            line = line.rstrip()
            if not line:
                continue
            lines.append(line)
            lines[:] = lines[-40:]
            # 渲染阶段占 60~99%
            m = render_re.search(line)
            if m and progress_cb:
                done, tot = int(m.group(1)), max(1, int(m.group(2)))
                pct = 60 + int(done / tot * 39)
                progress_cb(min(99, pct), "渲染画面中…")
        proc.wait(timeout=RENDER_TIMEOUT)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise RuntimeError(f"Remotion 渲染超时（>{RENDER_TIMEOUT}s），已终止。")

    if proc.returncode != 0:
        tail = "\n".join(lines[-12:])
        raise RuntimeError(f"Remotion 渲染失败（退出码 {proc.returncode}）:\n{tail}")

    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("Remotion 渲染完成但未产出有效 MP4。")

    logger.info(f"Remotion 渲染完成: {out_path}")


def compose(
    script: Dict[str, Any],
    workdir: Path,
    out_path: Path,
    job_id: str,
    progress_cb: ProgressCb = None,
    with_scene: bool = True,
) -> Path:
    """一步到位：文案 → 配音 + 信息动画视觉脚本 → 渲染 MP4。返回产物路径。渲染后清理 public 音频。"""
    try:
        build_props(script, workdir, job_id, progress_cb, with_scene=with_scene)
        render(workdir, out_path, progress_cb)
        return out_path
    finally:
        cleanup_public_job_dir(job_id)
