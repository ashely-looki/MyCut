"""Step 0（可选）：文案对齐先验。

阶段3 打通闭环：如果项目关联了文案（选题驱动模式），把文案的核心要点抽成
「对齐提示」，供 step3 评分时偏向匹配文案的片段。

- 输入：metadata/script.json（结构见阶段2 的大纲+分镜文案，若无则跳过）
- 输出：metadata/script_hints.json（{title, points: [...]}，供 step3 读取）

设计原则：纯旁路。没有 script.json 就什么都不做，clip_only 模式完全不受影响；
step1~6 的既有行为不变，step3 只在存在 hints 时把它作为额外相关性参考。
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _extract_points(script: Dict[str, Any]) -> List[str]:
    """从文案里抽取核心要点文本，用于相关性对齐。"""
    points: List[str] = []

    title = script.get("title")
    if title:
        points.append(str(title))

    # 大纲：hook / sections[].point / cta
    outline = script.get("outline") or {}
    if isinstance(outline, dict):
        if outline.get("hook"):
            points.append(str(outline["hook"]))
        for sec in outline.get("sections") or []:
            if isinstance(sec, dict) and sec.get("point"):
                points.append(str(sec["point"]))
        if outline.get("cta"):
            points.append(str(outline["cta"]))

    # 分镜文案：narration
    for seg in script.get("segments") or []:
        if isinstance(seg, dict) and seg.get("narration"):
            points.append(str(seg["narration"]))

    # 去重且保序，过滤空串
    seen = set()
    uniq: List[str] = []
    for p in points:
        p = p.strip()
        if p and p not in seen:
            seen.add(p)
            uniq.append(p)
    return uniq


def run_step0_script_align(metadata_dir: Path) -> Optional[Dict[str, Any]]:
    """读取 metadata/script.json → 写 metadata/script_hints.json。

    Returns:
        对齐提示 dict；若无关联文案则返回 None（表示走原始 clip_only 流程）。
    """
    script_path = Path(metadata_dir) / "script.json"
    if not script_path.exists():
        logger.info("未关联文案(script.json 不存在)，跳过 Step0 对齐，走原始切片流程")
        return None

    try:
        with open(script_path, "r", encoding="utf-8") as f:
            script = json.load(f)
    except Exception as e:  # noqa: BLE001
        logger.error("读取 script.json 失败: %s，跳过对齐", e)
        return None

    if not isinstance(script, dict):
        logger.warning("script.json 结构非对象，跳过对齐")
        return None

    points = _extract_points(script)
    if not points:
        logger.warning("文案中未抽取到有效要点，跳过对齐")
        return None

    hints = {"title": script.get("title", ""), "points": points}
    hints_path = Path(metadata_dir) / "script_hints.json"
    try:
        with open(hints_path, "w", encoding="utf-8") as f:
            json.dump(hints, f, ensure_ascii=False, indent=2)
        logger.info("Step0 文案对齐完成：抽取 %d 个要点 → %s", len(points), hints_path)
    except Exception as e:  # noqa: BLE001
        logger.error("写 script_hints.json 失败: %s", e)
        return None

    return hints
