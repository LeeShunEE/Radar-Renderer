"""应用配置。

配置来源优先级：环境变量 > ``backend/.env`` > 字段默认值（对齐 12-Factor）。
testenv 等环境通过环境变量注入连接配置（见 CLAUDE.md §3.3.1），不在仓库硬编码。
"""

import os
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

# app/core/config.py -> parents[2] == backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """全局配置项。"""

    # 数据库
    database_url: str = "sqlite+aiosqlite:///./data.db"

    # API
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # 鉴权
    jwt_secret_string: SecretStr = SecretStr(
        "dev-only-insecure-secret-change-me-via-env"
    )
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    jwt_refresh_expire_minutes: int = 60 * 24 * 7

    # 验证码
    verification_code_expire_minutes: int = 10
    verification_code_length: int = 6
    verification_code_cooldown_seconds: int = 60

    # Resend 邮件服务
    resend_api_key_secret_string: SecretStr | None = None
    resend_from_email: str = "onboarding@resend.dev"  # 默认 Resend 测试发件人，正式经 env 覆盖

    # Google OAuth
    oauth_google_client_id: str | None = None
    oauth_google_client_secret_secret_string: SecretStr | None = None
    oauth_google_redirect_uri: str | None = None

    # GitHub OAuth
    oauth_github_client_id: str | None = None
    oauth_github_client_secret_secret_string: SecretStr | None = None
    oauth_github_redirect_uri: str | None = None

    # OAuth state（CSRF nonce）有效期（分钟）
    oauth_state_expire_minutes: int = 10

    # 文件存储
    storage_root: Path = _BACKEND_ROOT / "storage"
    max_user_storage_bytes: int = 200 * 1024 * 1024  # 单用户上传文件大小配额（200MB）
    max_user_upload_count: int = 500  # 单用户上传文件数量限制

    # 渲染
    render_concurrency: int = 2
    worker_base_url: str = "http://localhost:3100"
    render_timeout_seconds: int = 600
    # worker 反向上报渲染进度的共享密钥（非用户态鉴权，防公网伪造）；生产经 env 覆盖。
    render_callback_token_secret_string: SecretStr = SecretStr(
        "dev-only-render-callback-token"
    )
    # 公共资源（silhouettes / music 等静态素材所在目录）
    # Docker 环境通过环境变量 PUBLIC_ASSETS_PATH 覆盖（见 deploy/docker-compose.yml）
    public_assets_path: Path = Path(
        os.getenv("PUBLIC_ASSETS_PATH", str(_BACKEND_ROOT / ".." / "frontend" / "public"))
    )

    # 是否在应用启动时自动拉起队列消费协程（测试中关闭以保证确定性）
    render_queue_autostart: bool = True

    # 渲染产物 GC（自动清理过期或超全局配额文件）
    output_gc_enabled: bool = True  # 是否启用产物 GC（测试隔离用）
    output_gc_interval_seconds: int = 3600  # GC 周期（秒），默认 1 小时
    output_gc_max_age_days: int = 7  # 产物保留天数
    output_gc_global_max_size_bytes: int = 10 * 1024 * 1024 * 1024  # 全局 outputs 目录最大大小（10GB）

    # 测试环境标识（启用测试端点，生产必须 false）
    testing: bool = False

    model_config = SettingsConfigDict(
        extra="ignore",
        env_file=_BACKEND_ROOT / ".env",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # 环境变量优先于 .env，便于 testenv/部署环境覆盖连接配置；
        # .env 仅用于本地开发，生产应走环境变量注入。
        return (
            init_settings,
            env_settings,
            dotenv_settings,
            file_secret_settings,
        )


settings = Settings()
