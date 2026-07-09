"""视觉脚本服务（自动成片信息动画，旁路模块）。

把一句口播文案 → 结构化「视觉脚本」(scene)：这句话涉及哪些关键概念、
每个用什么视觉元素表达（关键词大字 / 图标 / 序号步骤 / 箭头 / 对比）、
以及每个元素的入场时间点。Remotion 端按此脚本逐元素入场做信息动画。

复用现有 DeepSeek(LLMClient)。LLM 失败或返回不合法时，降级为「整句关键词」
兜底 scene（保证永远能出画面，不中断成片）。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

from ..utils.llm_client import LLMClient

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).parent.parent.parent / "prompt"
_SCENE_PROMPT = _PROMPT_DIR / "视觉脚本.txt"

# 合法版式与各版式合法的元素 type
_LAYOUTS = {"keyword", "steps", "arrow", "compare"}
_LAYOUT_TYPES = {
    "keyword": {"keyword", "icon"},
    "steps": {"step"},
    "arrow": {"arrowFrom", "arrowTo"},
    "compare": {"compareBad", "compareGood"},
}
# 图标词表（与 prompt 及 Remotion ICONS 保持一致；越界的图标名丢弃）
_ICON_VOCAB = {
    "user", "users", "brain", "robot", "search", "document", "book", "lightbulb", "idea", "target",
    "check", "cross", "warning", "star", "heart", "rocket", "chart", "growth", "clock", "calendar",
    "message", "chat", "question", "gear", "tool", "key", "lock", "link", "code", "data",
    "money", "trophy", "flag", "eye", "hand", "thumbsup", "list", "filter", "magnet", "sparkle",
}

MAX_ELEMENTS = 4  # 一句话画面最多元素数，超出截断


def _read_prompt(path: Path, fallback: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        logger.error("加载视觉脚本提示词失败(%s): %s", path, e)
        return fallback


class SceneService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self._prompt = _read_prompt(_SCENE_PROMPT, "把这句话拆成关键词视觉元素，输出 JSON 对象。")

    def build_scene(self, sentence: str, seconds: float, role: str = "body", context_title: str = "") -> Dict[str, Any]:
        """一句口播 → 视觉脚本 scene。任何异常都降级为兜底 scene（不抛）。"""
        sentence = (sentence or "").strip()
        if not sentence:
            return {"layout": "keyword", "elements": []}
        try:
            input_data = {
                "sentence": sentence,
                "role": role,
                "seconds": round(float(seconds), 2),
                "context_title": context_title,
            }
            response = self.llm.call_with_retry(self._prompt, input_data)
            parsed = self.llm.parse_json_response(response)
            scene = self._normalize(parsed, seconds)
            if scene["elements"]:
                return scene
            logger.warning("视觉脚本无有效元素，降级兜底: %s", sentence[:30])
        except Exception as e:  # noqa: BLE001
            logger.warning("视觉脚本生成失败，降级兜底(%s): %s", sentence[:30], e)
        return self._fallback(sentence)

    def _normalize(self, parsed: Any, seconds: float) -> Dict[str, Any]:
        """校验并规整 LLM 输出：版式合法、元素 type 匹配版式、enterAt 落界、图标在词表内。"""
        if isinstance(parsed, list):
            parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else {}
        if not isinstance(parsed, dict):
            return {"layout": "keyword", "elements": []}

        layout = parsed.get("layout")
        if layout not in _LAYOUTS:
            layout = "keyword"
        allowed_types = _LAYOUT_TYPES[layout]

        raw_elements = parsed.get("elements")
        if not isinstance(raw_elements, list):
            raw_elements = []

        elements: List[Dict[str, Any]] = []
        upper = max(0.0, float(seconds) - 0.2)  # enterAt 上界，留 0.2s 余量
        for el in raw_elements:
            if not isinstance(el, dict):
                continue
            etype = el.get("type")
            if etype not in allowed_types:
                continue
            text = str(el.get("text") or "").strip()
            if not text:
                continue
            icon = str(el.get("icon") or "").strip()
            if icon not in _ICON_VOCAB:
                icon = ""
            try:
                enter_at = float(el.get("enterAt") or 0.0)
            except (TypeError, ValueError):
                enter_at = 0.0
            enter_at = max(0.0, min(enter_at, upper))
            elements.append({
                "type": etype,
                "text": text[:16],  # 防止 LLM 把整句塞进来
                "icon": icon,
                "enterAt": round(enter_at, 2),
                "emphasis": bool(el.get("emphasis", False)),
            })
            if len(elements) >= MAX_ELEMENTS:
                break

        # 按入场时间排序，观感更顺
        elements.sort(key=lambda e: e["enterAt"])
        return {"layout": layout, "elements": elements}

    def _fallback(self, sentence: str) -> Dict[str, Any]:
        """兜底：把整句作为一个 keyword 大字（截断），保证有画面。"""
        text = sentence.strip()
        # 去掉句末标点，短一点更像标题
        text = text.rstrip("。！？；!?;，,、 ")
        if len(text) > 16:
            text = text[:16] + "…"
        return {
            "layout": "keyword",
            "elements": [{"type": "keyword", "text": text, "icon": "", "enterAt": 0.0, "emphasis": False}],
        }


_service: SceneService | None = None


def get_scene_service() -> SceneService:
    global _service
    if _service is None:
        _service = SceneService()
    return _service
