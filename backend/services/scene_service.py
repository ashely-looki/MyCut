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


# 入场时机参数：首个元素起手延迟、末个元素相对音频结束的收尾余量（秒）
_ENTER_LEAD = 0.35      # 第一个元素延迟入场，等画面/视频稳定
_ENTER_TAIL = 1.0       # 最后一个元素至少在音频结束前这么久出完，留时间看清

# 去标点用（判断关键词是否照抄原句时忽略标点差异）
_PUNCT = "，。！？、；：… ,.!?;:\"'（）()【】[]—-"


def _strip_punct(s: str) -> str:
    return "".join(ch for ch in s if ch not in _PUNCT)


def _is_copied_from_sentence(text: str, sentence: str) -> bool:
    """
    判断组件文字是否只是照抄原句（会和字幕重复）。
    规则：去标点后，text 若≥3 字且作为**连续子串**出现在原句里，视为照抄。
    （短于 3 字的词太通用，不算抄；概括/改写过的词不会连续命中。）
    """
    t = _strip_punct(text)
    s = _strip_punct(sentence)
    if len(t) < 3:
        return False
    return t in s


def _locate_ratio(keyword: str, sentence: str, fallback_ratio: float) -> float:
    """
    估算 keyword 在 sentence 里被念到的时间比例（0~1）。

    原理：配音基本匀速，词在句子里的**字符位置比例** ≈ 它在音频里被念到的时间比例。
    keyword 是提炼过的关键词，未必是原句子串，故按「关键词里的字」在原句中依次找位置，
    取命中字符的中点位置比例；完全找不到时用 fallback_ratio（按元素顺序的均匀位置）。
    """
    s = sentence.strip()
    if not s:
        return fallback_ratio
    # 收集 keyword 里的字在原句中的出现位置（顺序推进，避免重复字都匹配到开头）
    positions: List[int] = []
    cursor = 0
    for ch in keyword:
        if ch in "，。！？、；：… ,.!?;:":
            continue
        idx = s.find(ch, cursor)
        if idx >= 0:
            positions.append(idx)
            cursor = idx + 1
    if not positions:
        return fallback_ratio
    # 用命中位置的中点做代表（词的"重心"），比只看首字更稳
    mid = (positions[0] + positions[-1]) / 2.0
    return max(0.0, min(1.0, mid / max(1, len(s))))


def _distribute_enter_at(elements: List[Dict[str, Any]], seconds: float, sentence: str) -> None:
    """
    按关键词在原句里的**字符位置比例**估算入场时机，就地写回 enterAt（覆盖 LLM 的猜测）。

    edge-tts 中文拿不到词级时间戳，无法精确对齐；但配音基本匀速，故用「词在句中的位置」
    近似「词被念到的时刻」——比之前的"元素间均匀均分"准，因为它锚定了词的真实位置
    （关键词若集中在句子后半，入场也会相应靠后）。同时保证单调递增、落在留白区间内。
    """
    n = len(elements)
    if n == 0:
        return
    dur = max(0.5, float(seconds))
    lead = min(_ENTER_LEAD, dur * 0.2)          # 起手延迟
    tail = max(lead, dur - _ENTER_TAIL)          # 末尾余量
    span = max(0.01, tail - lead)

    prev = -1.0
    for i, el in enumerate(elements):
        fallback = i / (n - 1) if n > 1 else 0.0
        ratio = _locate_ratio(str(el.get("text", "")), sentence, fallback)
        t = lead + span * ratio
        # 单调递增：后一个词不早于前一个（+至少 0.25s 间隔，避免挤在一起同时弹出）
        if t <= prev:
            t = min(tail, prev + 0.25)
        prev = t
        el["enterAt"] = round(t, 2)


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
            scene = self._normalize(parsed, seconds, sentence)
            # 有有效元素就用；若为空（LLM 全在照抄被去重过滤光了），返回空 scene——
            # 不再 fallback 成"整句大字"，因为那恰恰会和字幕重复（正是要消除的问题）。
            # 有字幕托底，某句没组件没关系。
            return scene
        except Exception as e:  # noqa: BLE001
            logger.warning("视觉脚本生成失败，返回空组件(%s): %s", sentence[:30], e)
        return {"layout": "keyword", "elements": []}

    def _normalize(self, parsed: Any, seconds: float, sentence: str = "") -> Dict[str, Any]:
        """校验并规整 LLM 输出：版式合法、元素 type 匹配版式、enterAt 按字符位置对齐、图标在词表内。"""
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

        # 先按 LLM 给的相对顺序收集元素（保留它对"谁先谁后 / emphasis"的判断），
        # enterAt 的具体秒数不信 LLM（它只是凭 seconds 瞎猜，和真实配音节奏对不上），
        # 收集完后用音频时长重排（见下方 _distribute_enter_at）。
        elements: List[Dict[str, Any]] = []
        for el in raw_elements:
            if not isinstance(el, dict):
                continue
            etype = el.get("type")
            if etype not in allowed_types:
                continue
            text = str(el.get("text") or "").strip()
            if not text:
                continue
            # 去重兜底：LLM 若照抄原句连续片段（和字幕重复），丢弃这个元素
            if _is_copied_from_sentence(text, sentence):
                logger.info("组件文字照抄原句，丢弃避免与字幕重复: %s", text)
                continue
            icon = str(el.get("icon") or "").strip()
            if icon not in _ICON_VOCAB:
                icon = ""
            try:
                llm_enter = float(el.get("enterAt") or 0.0)  # 仅用于保持相对先后顺序
            except (TypeError, ValueError):
                llm_enter = 0.0
            elements.append({
                "type": etype,
                "text": text[:16],  # 防止 LLM 把整句塞进来
                "icon": icon,
                "_llm_enter": llm_enter,
                "emphasis": bool(el.get("emphasis", False)),
            })
            if len(elements) >= MAX_ELEMENTS:
                break

        # 保留 LLM 的相对顺序，再按音频时长把入场时机均匀重排（跟配音节奏走）
        elements.sort(key=lambda e: e["_llm_enter"])
        _distribute_enter_at(elements, seconds, sentence)
        for e in elements:
            e.pop("_llm_enter", None)
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
