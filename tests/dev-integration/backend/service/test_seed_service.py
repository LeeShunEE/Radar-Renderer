"""service/seed_service.py dev-integration 测试。

真实 SQLite 本地文件库（§4.1 允许）跑通 seed → 登录校验全链路，
覆盖真实密码哈希往返与幂等重启。
"""

from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.dao.orm import Base
from app.dao.user_dao import UserDAO
from app.service.auth_service import AuthService
from app.service.seed_service import seed_dev_account


@pytest.fixture
async def session(tmp_path: Path) -> AsyncGenerator[AsyncSession, None]:
    """建表后提供一个指向临时 SQLite 文件的会话。"""
    db_url = f"sqlite+aiosqlite:///{(tmp_path / 'seed.db').as_posix()}"
    engine = create_async_engine(db_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()


def _password() -> str:
    return settings.dev_seed_password_secret_string.get_secret_value()


class TestSeedDevAccountIntegration:
    async def test_seed_then_login(self, session, monkeypatch):
        """seed 后可用配置的用户名+密码登录，且账户已验证。"""
        monkeypatch.setattr(settings, "testing", True)
        await seed_dev_account(session)

        user = await AuthService(session).authenticate(
            username=settings.dev_seed_username,
            password=_password(),
        )
        assert user.username == settings.dev_seed_username
        assert user.email == settings.dev_seed_email
        assert user.is_verified is True

    async def test_seed_is_idempotent(self, session, monkeypatch):
        """重复 seed 不抛唯一约束，登录仍有效。"""
        monkeypatch.setattr(settings, "testing", True)
        await seed_dev_account(session)
        await seed_dev_account(session)

        user = await AuthService(session).authenticate(
            username=settings.dev_seed_username,
            password=_password(),
        )
        assert user is not None

    async def test_not_seeded_when_not_testing(self, session, monkeypatch):
        """生产环境（testing=False）不落任何测试账户。"""
        monkeypatch.setattr(settings, "testing", False)
        await seed_dev_account(session)

        exists = await UserDAO(session).exists_by_username(settings.dev_seed_username)
        assert exists is False
