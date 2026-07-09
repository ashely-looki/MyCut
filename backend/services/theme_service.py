"""视频主题配色服务（自动成片，旁路模块）。

按整条视频的选题（标题/领域/风格）让 LLM 挑一套最贴内容调性的画面配色——
科技冷蓝、暖情橙、深墨财经…而不是把成片锁死在产品 UI 的 DESIGN.md 那套单橙。

关键：不信任 LLM 的颜色手感会翻车，所以做两道硬约束——
  1) 每个颜色必须是合法 #RRGGBB，非法则丢弃回退默认。
  2) 强制字幕对比度：ink 对 bg、sub 对 bg 的 WCAG 对比度不足时，自动把 ink/sub 推到
     纯黑或纯白一侧，保证任何主题下字幕都清晰可读。
派生出 Remotion 需要但不必让 LLM 操心的字段（line/muted/accentSoft/onAccent/card）。
LLM 失败或不合法时，回退 DESIGN.md 默认主题（与产品 UI 一致）。
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from ..utils.llm_client import LLMClient

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).parent.parent.parent / "prompt"
_THEME_PROMPT = _PROMPT_DIR / "视频主题.txt"

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

# DESIGN.md 默认主题（LLM 失败/非法时回退，与产品 UI 一致）——浅色暖底单橙
DEFAULT_THEME: Dict[str, Any] = {
    "mood": "克制暖橙（默认）",
    "dark": False,
    "accent": "#E8710A",
    "bg": "#F6F5F3",
    "ink": "#1A1A19",
    "sub": "#6E6B66",
    "card": "#FFFFFF",
}

# 字幕对比度下限（WCAG 对比度，1~21）。低于此就把文字推向黑/白一侧。
_MIN_INK_CONTRAST = 6.0
_MIN_SUB_CONTRAST = 3.2


def _read_prompt(path: Path, fallback: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        logger.error("加载视频主题提示词失败(%s): %s", path, e)
        return fallback


# —— 颜色工具 ——
def _valid_hex(v: Any) -> Optional[str]:
    if isinstance(v, str) and _HEX_RE.match(v.strip()):
        return v.strip().upper()
    return None


def _to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _rel_luminance(hex_color: str) -> float:
    """WCAG 相对亮度（0=黑，1=白）。"""
    def chan(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4
    r, g, b = _to_rgb(hex_color)
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)


def _contrast(a: str, b: str) -> float:
    """两色 WCAG 对比度（1~21）。"""
    la, lb = _rel_luminance(a), _rel_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _mix(a: str, b: str, t: float) -> str:
    """线性混合两色，t=0 取 a、t=1 取 b。"""
    ra, ga, ba = _to_rgb(a)
    rb, gb, bb = _to_rgb(b)
    r = round(ra + (rb - ra) * t)
    g = round(ga + (gb - ga) * t)
    bl = round(ba + (bb - ba) * t)
    return f"#{r:02X}{g:02X}{bl:02X}"


def _accent_soft(accent: str, bg: str, dark: bool) -> str:
    """强调色的柔和背景（用于强调卡片底）：往 bg 方向大幅冲淡 accent。"""
    return _mix(accent, bg, 0.86 if not dark else 0.80)


class ThemeService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self._prompt = _read_prompt(_THEME_PROMPT, "为这条视频挑一套贴合内容的配色，输出 JSON 对象。")

    def build_theme(self, title: str, domain: str = "", style: str = "", sample: str = "") -> Dict[str, Any]:
        """整条视频调一次 → 一套主题配色（含派生字段）。异常降级默认主题（不抛）。"""
        try:
            input_data = {
                "title": (title or "").strip(),
                "domain": (domain or "").strip(),
                "style": (style or "").strip(),
                "sample": (sample or "").strip()[:120],
            }
            response = self.llm.call_with_retry(self._prompt, input_data)
            parsed = self.llm.parse_json_response(response)
            theme = self._normalize(parsed)
            logger.info("视频主题: %s (accent=%s bg=%s dark=%s)", theme["mood"], theme["accent"], theme["bg"], theme["dark"])
            return theme
        except Exception as e:  # noqa: BLE001
            logger.warning("视频主题生成失败，回退默认主题: %s", e)
            return self._derive(dict(DEFAULT_THEME))

    def _normalize(self, parsed: Any) -> Dict[str, Any]:
        """校验 LLM 输出的颜色合法性；非法字段回退默认。再补对比度约束与派生字段。"""
        if isinstance(parsed, list):
            parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else {}
        if not isinstance(parsed, dict):
            parsed = {}

        base = dict(DEFAULT_THEME)
        for key in ("accent", "bg", "ink", "sub", "card"):
            v = _valid_hex(parsed.get(key))
            if v:
                base[key] = v
        base["dark"] = bool(parsed.get("dark", base["dark"]))
        mood = parsed.get("mood")
        base["mood"] = (mood if isinstance(mood, str) and mood.strip() else DEFAULT_THEME["mood"])
        return self._derive(base)

    def _derive(self, t: Dict[str, Any]) -> Dict[str, Any]:
        """强制字幕对比度 + 派生 Remotion 需要的额外字段。"""
        bg, dark = t["bg"], t["dark"]

        # 1) 硬约束字幕对比度：不够就把 ink/sub 推向黑/白一侧
        black, white = "#000000", "#FFFFFF"
        text_pole = white if dark else black  # 深底推白、浅底推黑
        if _contrast(t["ink"], bg) < _MIN_INK_CONTRAST:
            # 逐步逼近文字极，直到达标（或到极值）
            for step in (0.4, 0.7, 1.0):
                cand = _mix(t["ink"], text_pole, step)
                if _contrast(cand, bg) >= _MIN_INK_CONTRAST:
                    t["ink"] = cand
                    break
            else:
                t["ink"] = text_pole
        if _contrast(t["sub"], bg) < _MIN_SUB_CONTRAST:
            for step in (0.4, 0.7, 1.0):
                cand = _mix(t["sub"], text_pole, step)
                if _contrast(cand, bg) >= _MIN_SUB_CONTRAST:
                    t["sub"] = cand
                    break
            else:
                t["sub"] = _mix(t["sub"], text_pole, 0.6)

        # 2) 派生字段
        # 发丝线：card 往 ink 方向淡淡混一点
        t["line"] = _mix(t["card"], t["ink"], 0.10 if not dark else 0.18)
        # 弱化色（对比项的灰）：ink 与 bg 之间偏 bg
        t["muted"] = _mix(t["ink"], bg, 0.5)
        # 强调色柔和底（强调卡片）
        t["accentSoft"] = _accent_soft(t["accent"], bg, dark)
        # 序号圆里文字色：accent 上放白还是黑，取对比高者
        t["onAccent"] = white if _contrast(white, t["accent"]) >= _contrast(black, t["accent"]) else black
        return t


_service: ThemeService | None = None


def get_theme_service() -> ThemeService:
    global _service
    if _service is None:
        _service = ThemeService()
    return _service
