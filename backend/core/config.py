"""
统一配置管理
集中管理应用的所有配置项
"""

import os
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict

class APISettings(BaseModel):
    """API配置"""
    dashscope_api_key: str = Field(default='', validation_alias=AliasChoices('API_DASHSCOPE_API_KEY'))
    model_name: str = Field(default='qwen-plus', validation_alias=AliasChoices('API_MODEL_NAME'))
    max_tokens: int = Field(default=4096, validation_alias=AliasChoices('API_MAX_TOKENS'))
    timeout: int = Field(default=30, validation_alias=AliasChoices('API_TIMEOUT'))

class DatabaseSettings(BaseModel):
    """数据库配置"""
    url: str = Field(default='sqlite:///./data/autoclip.db', validation_alias=AliasChoices('DATABASE_URL'))

class RedisSettings(BaseModel):
    """Redis配置"""
    url: str = Field(default='redis://localhost:6379/0', validation_alias=AliasChoices('REDIS_URL'))

class ProcessingSettings(BaseModel):
    """处理配置"""
    chunk_size: int = Field(default=5000, validation_alias=AliasChoices('PROCESSING_CHUNK_SIZE'))
    min_score_threshold: float = Field(default=0.7, validation_alias=AliasChoices('PROCESSING_MIN_SCORE_THRESHOLD'))
    max_clips_per_collection: int = Field(default=5, validation_alias=AliasChoices('PROCESSING_MAX_CLIPS_PER_COLLECTION'))
    max_retries: int = Field(default=3, validation_alias=AliasChoices('PROCESSING_MAX_RETRIES'))

class LoggingSettings(BaseModel):
    """日志配置"""
    level: str = Field(default='INFO', validation_alias=AliasChoices('LOG_LEVEL'))
    fmt: str = Field(default='%(asctime)s - %(name)s - %(levelname)s - %(message)s', validation_alias=AliasChoices('LOG_FORMAT'))
    file: str = Field(default='backend.log', validation_alias=AliasChoices('LOG_FILE'))

class Settings(BaseSettings):
    """应用设置"""
    # 允许 .env + 忽略未声明的键，避免"Extra inputs are not permitted"
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    environment: str = Field(default='development', validation_alias=AliasChoices('ENVIRONMENT'))
    debug: bool = Field(default=True, validation_alias=AliasChoices('DEBUG'))
    encryption_key: str = Field(default='', validation_alias=AliasChoices('ENCRYPTION_KEY'))

    # ---- CORS ----
    # 逗号分隔的允许来源，例如 "https://mycut.example.com,https://www.mycut.example.com"。
    # 同源部署（nginx 把 /api 反代到后端）时前后端同域，浏览器不发跨域请求，可留空。
    # 仅前后端分离部署（前端与后端不同域）时才需要填。留空 = 不放行任何跨域来源。
    cors_allow_origins: str = Field(default='', validation_alias=AliasChoices('CORS_ALLOW_ORIGINS'))

    # 直接定义字段，不使用嵌套的BaseModel
    database_url: str = Field(default='sqlite:///./data/autoclip.db', validation_alias=AliasChoices('DATABASE_URL'))
    redis_url: str = Field(default='redis://localhost:6379/0', validation_alias=AliasChoices('REDIS_URL'))
    api_dashscope_api_key: str = Field(default='', validation_alias=AliasChoices('API_DASHSCOPE_API_KEY'))
    api_model_name: str = Field(default='qwen-plus', validation_alias=AliasChoices('API_MODEL_NAME'))
    api_max_tokens: int = Field(default=4096, validation_alias=AliasChoices('API_MAX_TOKENS'))
    api_timeout: int = Field(default=30, validation_alias=AliasChoices('API_TIMEOUT'))
    processing_chunk_size: int = Field(default=5000, validation_alias=AliasChoices('PROCESSING_CHUNK_SIZE'))
    processing_min_score_threshold: float = Field(default=0.7, validation_alias=AliasChoices('PROCESSING_MIN_SCORE_THRESHOLD'))
    processing_max_clips_per_collection: int = Field(default=5, validation_alias=AliasChoices('PROCESSING_MAX_CLIPS_PER_COLLECTION'))
    processing_max_retries: int = Field(default=3, validation_alias=AliasChoices('PROCESSING_MAX_RETRIES'))
    log_level: str = Field(default='INFO', validation_alias=AliasChoices('LOG_LEVEL'))
    log_format: str = Field(default='%(asctime)s - %(name)s - %(levelname)s - %(message)s', validation_alias=AliasChoices('LOG_FORMAT'))
    log_file: str = Field(default='backend.log', validation_alias=AliasChoices('LOG_FILE'))

    # ---- Supabase 认证（注册/登录）----
    # 说明：前端用 Supabase JS 登录并携带 access_token；后端用下面的 JWT secret
    # 校验该 token（HS256），取出真实 user_id 做项目隔离。
    # auth_enabled=false 时后端不强制登录（老数据/本地调试兼容）。
    supabase_url: str = Field(default='', validation_alias=AliasChoices('SUPABASE_URL'))
    supabase_jwt_secret: str = Field(default='', validation_alias=AliasChoices('SUPABASE_JWT_SECRET'))
    auth_enabled: bool = Field(default=False, validation_alias=AliasChoices('AUTH_ENABLED'))

    # ---- 支付宝支付（电脑网站支付 alipay.trade.page.pay）----
    # 沙箱调试：ALIPAY_ENABLED=true 且填了 APPID + 应用私钥 + 支付宝公钥时才启用支付接口。
    # 私钥/公钥是多行 PEM，推荐用「文件路径」方式（*_KEY_PATH），避免 .env 里塞多行；
    # 也支持直接把 PEM 内容填进 *_KEY（换行用 \n）。二者都填时优先用文件路径。
    alipay_enabled: bool = Field(default=False, validation_alias=AliasChoices('ALIPAY_ENABLED'))
    alipay_app_id: str = Field(default='', validation_alias=AliasChoices('ALIPAY_APP_ID'))
    # 网关：沙箱 https://openapi-sandbox.dl.alipaydev.com/gateway.do；生产 https://openapi.alipay.com/gateway.do
    alipay_server_url: str = Field(
        default='https://openapi-sandbox.dl.alipaydev.com/gateway.do',
        validation_alias=AliasChoices('ALIPAY_SERVER_URL'))
    alipay_sign_type: str = Field(default='RSA2', validation_alias=AliasChoices('ALIPAY_SIGN_TYPE'))
    # 应用私钥（商户自己生成，签名用）
    alipay_app_private_key: str = Field(default='', validation_alias=AliasChoices('ALIPAY_APP_PRIVATE_KEY'))
    alipay_app_private_key_path: str = Field(default='', validation_alias=AliasChoices('ALIPAY_APP_PRIVATE_KEY_PATH'))
    # 支付宝公钥（支付宝提供，验签用）
    alipay_public_key: str = Field(default='', validation_alias=AliasChoices('ALIPAY_PUBLIC_KEY'))
    alipay_public_key_path: str = Field(default='', validation_alias=AliasChoices('ALIPAY_PUBLIC_KEY_PATH'))
    # 支付宝服务器异步通知本笔支付结果的地址（必须公网可达；沙箱本地可用内网穿透）
    alipay_notify_url: str = Field(default='', validation_alias=AliasChoices('ALIPAY_NOTIFY_URL'))
    # 付款完成后浏览器同步跳回的地址（仅用于展示，不作发货依据）
    alipay_return_url: str = Field(default='', validation_alias=AliasChoices('ALIPAY_RETURN_URL'))
    # 会员单价（元/月），先写死一个月会员套餐
    membership_month_price: str = Field(default='98.00', validation_alias=AliasChoices('MEMBERSHIP_MONTH_PRICE'))

# 全局配置实例
settings = Settings()

def get_project_root() -> Path:
    """获取项目根目录"""
    # 使用新的路径工具
    from ..core.path_utils import get_project_root as get_root
    return get_root()

def get_data_directory() -> Path:
    """获取数据目录"""
    from ..core.path_utils import get_data_directory as get_dir
    return get_dir()

def get_uploads_directory() -> Path:
    """获取上传文件目录"""
    from ..core.path_utils import get_uploads_directory as get_dir
    return get_dir()

def get_temp_directory() -> Path:
    """获取临时文件目录"""
    from ..core.path_utils import get_temp_directory as get_dir
    return get_dir()

def get_output_directory() -> Path:
    """获取输出文件目录"""
    from ..core.path_utils import get_output_directory as get_dir
    return get_dir()

def get_database_url() -> str:
    """获取数据库URL"""
    return settings.database_url

def get_redis_url() -> str:
    """获取Redis URL"""
    return settings.redis_url

def get_api_key() -> Optional[str]:
    """获取API密钥"""
    return settings.api_dashscope_api_key if settings.api_dashscope_api_key else None

def get_supabase_config() -> Dict[str, Any]:
    """获取 Supabase 认证配置"""
    return {
        "url": settings.supabase_url,
        "jwt_secret": settings.supabase_jwt_secret,
        # 显式开启，且至少有一种验签依据：
        # - URL（走 JWKS 公钥验签，ES256/RS256，新版 Supabase 默认）
        # - JWT secret（走 HS256，老项目/回退）
        "auth_enabled": settings.auth_enabled and bool(settings.supabase_url or settings.supabase_jwt_secret),
    }

def _load_key(inline: str, path: str) -> str:
    """读取 PEM 密钥：优先文件路径，其次内联（内联里 \\n 还原为真换行）。"""
    if path:
        try:
            return Path(path).expanduser().read_text(encoding='utf-8').strip()
        except OSError:
            return ''
    if inline:
        return inline.replace('\\n', '\n').strip()
    return ''

def get_alipay_config() -> Dict[str, Any]:
    """获取支付宝支付配置。

    enabled：显式开启且 APPID/应用私钥/支付宝公钥齐全时才算真正可用。
    private_key/public_key：已解析成 PEM 文本，可直接喂给 SDK。
    """
    private_key = _load_key(settings.alipay_app_private_key, settings.alipay_app_private_key_path)
    public_key = _load_key(settings.alipay_public_key, settings.alipay_public_key_path)
    return {
        "enabled": settings.alipay_enabled and bool(settings.alipay_app_id and private_key and public_key),
        "app_id": settings.alipay_app_id,
        "server_url": settings.alipay_server_url,
        "sign_type": settings.alipay_sign_type,
        "app_private_key": private_key,
        "alipay_public_key": public_key,
        "notify_url": settings.alipay_notify_url,
        "return_url": settings.alipay_return_url,
        "month_price": settings.membership_month_price,
    }

def get_cors_allow_origins() -> list:
    """解析 CORS 允许来源（逗号分隔）。返回列表；留空返回 []（不放行跨域）。"""
    raw = (settings.cors_allow_origins or '').strip()
    if not raw:
        return []
    return [o.strip() for o in raw.split(',') if o.strip()]

def get_model_config() -> Dict[str, Any]:
    """获取模型配置"""
    return {
        "model_name": settings.api_model_name,
        "max_tokens": settings.api_max_tokens,
        "timeout": settings.api_timeout
    }

def get_processing_config() -> Dict[str, Any]:
    """获取处理配置"""
    return {
        "chunk_size": settings.processing_chunk_size,
        "min_score_threshold": settings.processing_min_score_threshold,
        "max_clips_per_collection": settings.processing_max_clips_per_collection,
        "max_retries": settings.processing_max_retries
    }

def get_logging_config() -> Dict[str, Any]:
    """获取日志配置"""
    log_format = settings.log_format
    if log_format.lower() == "json":
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    return {
        "level": settings.log_level,
        "format": log_format,
        "file": settings.log_file
    }

# 初始化路径配置
def init_paths():
    """初始化路径配置"""
    project_root = get_project_root()
    data_dir = get_data_directory()
    uploads_dir = get_uploads_directory()
    temp_dir = get_temp_directory()
    output_dir = get_output_directory()
    
    print(f"项目根目录: {project_root}")
    print(f"数据目录: {data_dir}")
    print(f"上传目录: {uploads_dir}")
    print(f"临时目录: {temp_dir}")
    print(f"输出目录: {output_dir}")

if __name__ == "__main__":
    # 测试配置加载
    init_paths()
    print(f"数据库URL: {get_database_url()}")
    print(f"Redis URL: {get_redis_url()}")
    print(f"API配置: {get_model_config()}")
    print(f"处理配置: {get_processing_config()}") 
