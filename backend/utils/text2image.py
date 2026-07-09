"""
文生图工具（用于自动成片给分镜配画面，旁路模块）。

引擎：Pollinations.ai —— 免费、免 key，GET 一个 URL 即出图。
只作首版画面来源；失败不中断整条成片流水线（该分镜回退无图=纯字幕）。

注：即梦 Dreamina CLI 也能出图但要求高级会员，故首版用 Pollinations。
"""

import logging
import urllib.parse
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"
# 通用风格后缀（英文，Pollinations 对英文风格词更稳）——克制现代插画、科普感
STYLE_SUFFIX = "clean modern illustration, science popularization style, soft lighting, 16:9"
REQUEST_TIMEOUT = 90  # Pollinations 首图可能较慢


def build_prompt(visual: str = "", fallback: str = "") -> str:
    """
    组装文生图 prompt：分镜画面建议 visual 为主（中文原样），拼英文风格后缀。
    visual 为空时用 fallback（如 narration/title）。
    """
    core = (visual or "").strip() or (fallback or "").strip() or "abstract concept illustration"
    return f"{core}, {STYLE_SUFFIX}"


def generate(prompt: str, out_path: Path, width: int = 1280, height: int = 720, seed: int = 0) -> bool:
    """
    文生图 → 保存到 out_path。成功返回 True，失败返回 False（不抛异常）。

    Args:
        prompt: 生成提示词
        out_path: 输出图片路径（.jpg）
        width/height: 尺寸（默认 16:9）
        seed: 随机种子（不同分镜给不同 seed，避免同质）
    """
    prompt = (prompt or "").strip()
    if not prompt:
        return False

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    encoded = urllib.parse.quote(prompt, safe="")
    url = f"{POLLINATIONS_BASE}/{encoded}?width={width}&height={height}&nologo=true&seed={seed}"

    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        content = resp.content
        # 基础校验：是图片、非空、非错误页
        ctype = resp.headers.get("Content-Type", "")
        if not content or "image" not in ctype:
            logger.warning(f"文生图返回非图片内容 (ctype={ctype}, {len(content)}B): {prompt[:40]}")
            return False
        with open(out_path, "wb") as f:
            f.write(content)
        logger.info(f"文生图成功 ({len(content)}B): {out_path.name} ← {prompt[:40]}")
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"文生图失败（回退无图）: {e} | prompt={prompt[:40]}")
        return False
