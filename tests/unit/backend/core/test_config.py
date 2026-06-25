"""Settings 配置单元测试：验证 database_url 动态构造逻辑。"""

import pytest
from pydantic import SecretStr

from app.core.config import Settings


class TestDatabaseUrlResolution:
    """测试 database_url 的动态构造优先级。"""

    def test_explicit_database_url_used_directly(self) -> None:
        """显式设置的 database_url（环境变量/.env）应直接使用。"""
        settings = Settings(database_url="postgresql+asyncpg://custom:pass@host:5432/db")
        assert settings.database_url == "postgresql+asyncpg://custom:pass@host:5432/db"

    def test_construct_from_postgres_fields(self) -> None:
        """无显式 database_url 时，按 POSTGRES_* 字段拼接 PostgreSQL URL。"""
        settings = Settings(
            postgres_user="testuser",
            postgres_password_secret_string=SecretStr("testpass"),
            postgres_db="testdb",
            postgres_host="testhost",
            postgres_port=5433,
            database_url=None,
        )
        assert settings.database_url == (
            "postgresql+asyncpg://testuser:testpass@testhost:5433/testdb"
        )

    def test_default_postgres_fields_fallback(self) -> None:
        """无任何配置时，使用默认 POSTGRES_* 字段值拼接。"""
        settings = Settings(database_url=None)
        # 默认值：user=radar, password=radar_dev_password, db=radar_chart, host=localhost, port=5432
        assert settings.database_url == (
            "postgresql+asyncpg://radar:radar_dev_password@localhost:5432/radar_chart"
        )