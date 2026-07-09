"""
TTS 工具：把口播文案合成为语音（用于 Remotion 自动成片，旁路模块）。

引擎：edge-tts（微软 Edge 在线 TTS，免费、免 key、中文声音自然）。
中文默认声音：zh-CN-YunjianNeural（云健，沉稳男声，适合知识解说）。

注意：edge-tts 的中文 WordBoundary 事件不可靠（中文无词间空格），
因此本模块只负责“一句 → 一段音频 + 时长”，字幕时间轴由调用方按句排布。
"""

import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

from .ffmpeg_utils import get_ffprobe_path

logger = logging.getLogger(__name__)

DEFAULT_VOICE = "zh-CN-YunjianNeural"


class TTSNotAvailable(RuntimeError):
    """edge-tts 未安装或不可用。"""


def _probe_duration(audio_path: Path) -> float:
    """用 ffprobe 读音频时长（秒）。失败返回 0.0。"""
    try:
        result = subprocess.run(
            [
                get_ffprobe_path(),
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=nw=1:nk=1",
                str(audio_path),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return float(result.stdout.strip())
    except Exception as e:  # noqa: BLE001
        logger.warning(f"ffprobe 读音频时长失败 {audio_path}: {e}")
    return 0.0


async def _synthesize_async(text: str, out_path: Path, voice: str) -> None:
    try:
        import edge_tts
    except ImportError as e:  # pragma: no cover
        raise TTSNotAvailable(
            "edge-tts 未安装。请运行 pip install edge-tts（自动成片依赖）。"
        ) from e

    communicate = edge_tts.Communicate(text, voice)
    with open(out_path, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])


def synthesize(text: str, out_path: Path, voice: str = DEFAULT_VOICE) -> float:
    """
    合成一句语音到 out_path（mp3），返回音频时长（秒）。

    Args:
        text: 要念的文案（一句）
        out_path: 输出 mp3 路径
        voice: edge-tts 声音（默认云健男声）

    Returns:
        音频时长（秒）；合成失败或空文本返回 0.0（不抛异常中断整条流水线）。
    """
    text = (text or "").strip()
    if not text:
        return 0.0

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # edge-tts 是 async；在同步上下文里用独立事件循环跑
    try:
        asyncio.run(_synthesize_async(text, out_path, voice))
    except TTSNotAvailable:
        raise
    except RuntimeError as e:
        # 已有运行中的事件循环（极少见）——退化为新线程跑
        if "event loop" in str(e).lower():
            import threading
            err: list[Optional[BaseException]] = [None]

            def _run() -> None:
                try:
                    asyncio.run(_synthesize_async(text, out_path, voice))
                except BaseException as inner:  # noqa: BLE001
                    err[0] = inner

            t = threading.Thread(target=_run)
            t.start()
            t.join()
            if err[0] is not None:
                raise err[0]
        else:
            raise

    if not out_path.exists() or out_path.stat().st_size == 0:
        logger.warning(f"TTS 合成产物为空: {out_path}")
        return 0.0

    return _probe_duration(out_path)


def is_available() -> bool:
    """edge-tts 是否可用（已安装）。"""
    try:
        import edge_tts  # noqa: F401
        return True
    except ImportError:
        return False
