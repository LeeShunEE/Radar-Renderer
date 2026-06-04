from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # 数据库配置
    database_url: str = "sqlite+aiosqlite:///./data.db"

    # API 配置
    api_prefix: str = "/api/v1"

    model_config = {"env_file": ".env"}


settings = Settings()