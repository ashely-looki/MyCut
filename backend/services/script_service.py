"""大纲/文案生成服务（阶段2）。

从选题正向创作:
- generate_outline(topic, duration) → 大纲 {hook, sections[], cta}
- generate_script(title, outline, style, duration) → 分镜文案 [{index, role, narration, visual, est_seconds}]

复用 DeepSeek(LLMClient)。不落库，直接返回结构化数据（前端可编辑）。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

from ..utils.llm_client import LLMClient

logger = logging.getLogger(__name__)

_PROMPT_DIR = Path(__file__).parent.parent.parent / "prompt"
_OUTLINE_PROMPT = _PROMPT_DIR / "大纲生成.txt"
_SCRIPT_PROMPT = _PROMPT_DIR / "文案生成.txt"

_OUTLINE_FIELDS = {"hook": "", "sections": [], "cta": ""}
_SEGMENT_FIELDS = {"index": 0, "role": "body", "narration": "", "visual": "", "est_seconds": 0}


def _read_prompt(path: Path, fallback: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        logger.error("加载提示词失败(%s): %s", path, e)
        return fallback


class ScriptService:
    def __init__(self) -> None:
        self.llm = LLMClient()
        self._outline_prompt = _read_prompt(_OUTLINE_PROMPT, "根据选题生成大纲，输出 JSON 对象。")
        self._script_prompt = _read_prompt(_SCRIPT_PROMPT, "根据大纲生成分镜文案，输出 JSON 数组。")

    def generate_outline(self, topic: Dict[str, Any], duration: int = 60) -> Dict[str, Any]:
        """选题 → 大纲。"""
        input_data = {
            "title": topic.get("title", ""),
            "angle": topic.get("angle", ""),
            "target_audience": topic.get("target_audience", ""),
            "keywords": topic.get("keywords", []),
            "duration": duration,
        }
        response = self.llm.call_with_retry(self._outline_prompt, input_data)
        return self._parse_outline(response)

    def generate_script(
        self,
        title: str,
        outline: Dict[str, Any],
        style: str = "干货",
        duration: int = 60,
    ) -> List[Dict[str, Any]]:
        """大纲 → 分镜文案。"""
        input_data = {
            "title": title,
            "outline": outline,
            "style": style,
            "duration": duration,
        }
        response = self.llm.call_with_retry(self._script_prompt, input_data)
        return self._parse_segments(response)

    def _parse_outline(self, response: str) -> Dict[str, Any]:
        try:
            parsed = self.llm.parse_json_response(response)
        except Exception as e:  # noqa: BLE001
            logger.error("解析大纲 JSON 失败: %s", e)
            return {**_OUTLINE_FIELDS}
        if isinstance(parsed, list):
            parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else {}
        if not isinstance(parsed, dict):
            return {**_OUTLINE_FIELDS}
        outline = {**_OUTLINE_FIELDS, **parsed}
        # 规整 sections
        secs = outline.get("sections")
        if not isinstance(secs, list):
            outline["sections"] = []
        else:
            outline["sections"] = [
                {"point": s.get("point", ""), "detail": s.get("detail", "")}
                for s in secs if isinstance(s, dict)
            ]
        return outline

    def _parse_segments(self, response: str) -> List[Dict[str, Any]]:
        try:
            parsed = self.llm.parse_json_response(response)
        except Exception as e:  # noqa: BLE001
            logger.error("解析分镜文案 JSON 失败: %s", e)
            return []
        if isinstance(parsed, dict):
            parsed = parsed.get("segments") or parsed.get("data") or [parsed]
        if not isinstance(parsed, list):
            return []
        segments: List[Dict[str, Any]] = []
        for i, item in enumerate(parsed):
            if not isinstance(item, dict):
                continue
            seg = {**_SEGMENT_FIELDS, **item}
            try:
                seg["index"] = int(seg.get("index") or (i + 1))
            except (TypeError, ValueError):
                seg["index"] = i + 1
            try:
                seg["est_seconds"] = int(seg.get("est_seconds") or 0)
            except (TypeError, ValueError):
                seg["est_seconds"] = 0
            if seg.get("role") not in ("hook", "body", "cta"):
                seg["role"] = "body"
            segments.append(seg)
        return segments


_service: ScriptService | None = None


def get_script_service() -> ScriptService:
    global _service
    if _service is None:
        _service = ScriptService()
    return _service
