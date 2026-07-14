"""
Higgsfield 文生视频服务（自动成片实拍素材路线，旁路模块）。

把「一句英文画面提示词」→ 调 Higgsfield CLI 生成一段实拍级空镜（mp4）→ 下载到
remotion/public/ 下 → 返回 staticFile 相对路径，供 compose_service 填进
segment.visualSrc（visualType='video'），Remotion 端全屏铺底合成。

与 scene_service（信息动画）并列的另一种上区画面来源；素材驱动的解说混剪走这条。

设计约束：
- **认证不经过本服务**：Higgsfield CLI 用 OAuth 存本地 token，用户已 `higgsfield auth login`。
  本服务只调 CLI，不碰密钥、不落密钥。
- **可选/可降级**：CLI 未装 / 未登录 / 生成失败，一律返回 None，绝不中断成片
  （上层回退到 scene 或静图）。
- **省额度**：生成前可估价；同一 prompt 的产物按内容 hash 缓存，命中不重生。
- **配置走环境变量**，不写死：
    HIGGSFIELD_MODEL          默认视频模型（默认 kling3_0）
    HIGGSFIELD_ENABLE         是否启用实拍素材（"1"/"true" 开；默认关，不影响现有科普路线）
    HIGGSFIELD_MAX_CREDITS    单条视频生成额度上限（超过则停止再生，保护余额；默认无上限）
    AUTOCLIP_NPX_PATH         npx 路径（复用 ffmpeg_utils）
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.path_utils import get_project_root
from ..utils.ffmpeg_utils import get_npx_path

logger = logging.getLogger(__name__)

CLI_PACKAGE = "@higgsfield/cli"
CLI_BIN = "higgsfield"
DEFAULT_MODEL = "kling3_0"
DEFAULT_DURATION = 5  # 秒；单段空镜时长
DEFAULT_ASPECT = "16:9"
# CLI 调用超时：查询类短、生成类长
QUERY_TIMEOUT = 60
GENERATE_TIMEOUT = 900


class HiggsfieldNotReady(RuntimeError):
    """Higgsfield CLI 未就绪（未装 / 未登录 / 未选 workspace）。"""


def _npx_base() -> List[str]:
    """`npx -y -p @higgsfield/cli higgsfield` 前缀。"""
    return [get_npx_path(), "-y", "-p", CLI_PACKAGE, CLI_BIN]


def _run_cli(args: List[str], timeout: int, want_json: bool = True) -> Any:
    """
    跑一条 higgsfield CLI 子命令。want_json 时追加 --json 并解析返回。
    失败抛异常（由上层决定降级），不在这里吞。
    """
    cmd = _npx_base() + list(args)
    if want_json:
        cmd.append("--json")
    proc = subprocess.run(
        cmd,
        cwd=str(get_project_root()),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-400:]
        raise RuntimeError(f"higgsfield CLI 失败（退出码 {proc.returncode}）: {tail}")
    out = (proc.stdout or "").strip()
    if not want_json:
        return out
    # CLI 有时在 JSON 前后夹杂日志行，截取第一个 [ 或 { 到末尾
    start = min([i for i in (out.find("["), out.find("{")) if i >= 0], default=-1)
    if start < 0:
        raise RuntimeError(f"higgsfield CLI 未返回 JSON: {out[:200]}")
    return json.loads(out[start:])


def enabled() -> bool:
    """是否启用实拍素材路线。现在默认开启（实拍是默认成片形态）；仅 HIGGSFIELD_DISABLE 强制关。"""
    return not disabled()


def disabled() -> bool:
    """是否被显式关闭（HIGGSFIELD_DISABLE=1/true 时全局停用实拍，用于调试或省额度）。"""
    return os.environ.get("HIGGSFIELD_DISABLE", "").strip().lower() in {"1", "true", "yes", "on"}


def _model() -> str:
    return (os.environ.get("HIGGSFIELD_MODEL") or DEFAULT_MODEL).strip()


def _max_credits() -> Optional[float]:
    raw = os.environ.get("HIGGSFIELD_MAX_CREDITS", "").strip()
    if not raw:
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def is_available() -> bool:
    """CLI 能跑且已登录（能拿到 token）。任何异常视为不可用。"""
    try:
        token = _run_cli(["auth", "token"], QUERY_TIMEOUT, want_json=False)
        return bool(token and token.strip())
    except Exception as e:  # noqa: BLE001
        logger.info("Higgsfield 不可用（未装/未登录）: %s", e)
        return False


def estimate_cost(prompt: str, duration: int = DEFAULT_DURATION, aspect: str = DEFAULT_ASPECT) -> Optional[float]:
    """
    估算生成一段视频的额度消耗（不生成、不花钱）。解析失败返回 None。
    CLI 输出形如 "10 credits"。
    """
    try:
        raw = _run_cli(
            ["generate", "cost", _model(),
             "--prompt", prompt, "--aspect_ratio", aspect, "--duration", str(duration)],
            QUERY_TIMEOUT,
            want_json=False,
        )
        # 取第一段数字
        num = ""
        for ch in raw.strip():
            if ch.isdigit() or ch == ".":
                num += ch
            elif num:
                break
        return float(num) if num else None
    except Exception as e:  # noqa: BLE001
        logger.warning("Higgsfield 估价失败: %s", e)
        return None


def _cache_name(cache_key: str, duration: int, aspect: str) -> str:
    """
    按 (model, cache_key, duration, aspect) 内容 hash 命名，供缓存复用。

    cache_key 应传**稳定的句子原文**，而非 LLM 生成的英文 prompt——后者每次生成都有
    细微差别，hash 每次都变，缓存永不命中、重复扣费。用句子原文才能让「同一句话复用
    同一段视频」。
    """
    key = f"{_model()}|{cache_key}|{duration}|{aspect}".encode("utf-8")
    return "hf_" + hashlib.sha1(key).hexdigest()[:16] + ".mp4"


def _download(url: str, dest: Path, timeout: int = 120) -> bool:
    """
    下载 result_url 到 dest。

    优先用系统 curl：macOS 自带 Python 的 urllib 常因找不到 CA 根证书而
    SSL: CERTIFICATE_VERIFY_FAILED（曾导致视频已生成扣费、却下载不下来）。
    curl 用系统证书链，稳。curl 不可用时再退回 urllib（并显式带证书）。
    """
    import shutil as _shutil

    dest.parent.mkdir(parents=True, exist_ok=True)

    curl = _shutil.which("curl")
    if curl:
        try:
            proc = subprocess.run(
                [curl, "-fsSL", "-o", str(dest), url],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout,
            )
            if proc.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
                return True
            logger.warning("curl 下载失败（退出码 %s）: %s", proc.returncode, (proc.stderr or "").strip()[-200:])
        except Exception as e:  # noqa: BLE001
            logger.warning("curl 下载异常，改试 urllib: %s", e)

    # 兜底：urllib + certifi（有则用 certifi 的 CA，绕开系统缺证书问题）
    try:
        import ssl
        import urllib.request

        ctx = None
        try:
            import certifi

            ctx = ssl.create_default_context(cafile=certifi.where())
        except Exception:  # noqa: BLE001
            ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "mycut-compose/1.0"})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp, open(dest, "wb") as f:
            f.write(resp.read())
        return dest.exists() and dest.stat().st_size > 0
    except Exception as e:  # noqa: BLE001
        logger.warning("下载生成视频失败 %s: %s", url, e)
        return False


def get_cache_dir() -> Path:
    """
    持久素材缓存目录（remotion/public/hf_cache/）。

    与 job 目录分离：job 目录（compose/<job_id>/）渲染后会被 cleanup 清理，缓存不能放那，
    否则每次重跑都缓存不到、重复扣费。缓存放这里长期留存，命中时复制一份到 job 目录供渲染。
    """
    return get_project_root() / "remotion" / "public" / "hf_cache"


def generate_clip(
    prompt: str,
    dest_dir: Path,
    duration: int = DEFAULT_DURATION,
    aspect: str = DEFAULT_ASPECT,
    rel_prefix: str = "",
    cache_key: str = "",
) -> Optional[str]:
    """
    生成一段实拍空镜并落到 dest_dir，返回相对 remotion/public/ 的 staticFile 路径。
    任何失败返回 None（上层回退）。命中持久缓存不重生（省额度）。

    Args:
        prompt: 英文画面提示词（video_prompt_service 产出，每次可能有细微差别）
        dest_dir: 本次成片的落地目录（在 remotion/public/ 下，如 compose/<job_id>/，渲染后会被清理）
        duration: 片段秒数
        aspect: 宽高比
        rel_prefix: 返回相对路径的前缀（如 'compose/<job_id>'），拼到文件名前
        cache_key: 缓存键，应传**稳定的句子原文**（缺省回退用 prompt）。同 key 复用同一段视频。

    Returns:
        staticFile 相对路径（如 'compose/<job_id>/hf_xxx.mp4'）；失败 None
    """
    import shutil as _shutil

    prompt = (prompt or "").strip()
    if not prompt:
        return None

    # 缓存键用句子原文（稳定）；没传则退回 prompt（不稳定，仅兜底）
    key = (cache_key or "").strip() or prompt
    fname = _cache_name(key, duration, aspect)
    dest = dest_dir / fname
    rel = f"{rel_prefix}/{fname}" if rel_prefix else fname

    cache_dir = get_cache_dir()
    cached = cache_dir / fname

    # 1) 本 job 目录已有（同条视频内重复句）：直接复用
    if dest.exists() and dest.stat().st_size > 0:
        logger.info("Higgsfield job 内命中，跳过生成: %s", fname)
        return rel

    # 2) 持久缓存命中（跨视频/重跑同一句）：复制到 job 目录，不生成、不扣费
    if cached.exists() and cached.stat().st_size > 0:
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            _shutil.copy(cached, dest)
            logger.info("Higgsfield 持久缓存命中，跳过生成（省额度）: %s", fname)
            return rel
        except Exception as e:  # noqa: BLE001
            logger.warning("缓存复制失败，改为重新生成: %s", e)

    # 3) 未命中：真正生成
    try:
        result = _run_cli(
            ["generate", "create", _model(),
             "--prompt", prompt,
             "--aspect_ratio", aspect,
             "--duration", str(duration),
             "--wait", "--wait-timeout", "10m", "--wait-interval", "8s"],
            GENERATE_TIMEOUT,
            want_json=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("Higgsfield 生成失败，回退: %s", e)
        return None

    # CLI 返回一个 job 数组（--wait 后含 result_url）
    jobs = result if isinstance(result, list) else [result]
    url = None
    for job in jobs:
        if isinstance(job, dict) and job.get("status") == "completed" and job.get("result_url"):
            url = job["result_url"]
            break
    if not url:
        logger.warning("Higgsfield 未返回可用 result_url，回退。jobs=%s", str(jobs)[:200])
        return None

    if not _download(url, dest):
        return None

    # 存一份到持久缓存，供以后同一句复用（不随 job 清理消失）
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        if not cached.exists():
            _shutil.copy(dest, cached)
    except Exception as e:  # noqa: BLE001
        logger.warning("写入持久缓存失败（不影响本次）: %s", e)

    logger.info("Higgsfield 生成完成: %s（%s）", fname, url)
    return rel
