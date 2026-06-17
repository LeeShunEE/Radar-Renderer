"""OAuthDAO 单元测试（真实内存 SQLite，覆盖真实 SQL 路径）。"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.oauth_dao import OAuthDAO
from app.dao.orm import UserORM


async def _seed_user(session: AsyncSession, email: str = "a@b.com") -> int:
    """插入一个用户并返回其 id（OAuthAccountORM.user_id 外键依赖）。"""
    orm = UserORM(email=email, username=None, is_verified=True)
    session.add(orm)
    await session.commit()
    await session.refresh(orm)
    return orm.id


def _dao(session: AsyncSession) -> OAuthDAO:
    return OAuthDAO(session)


class TestCreateAndGetByProviderUserId:
    async def test_create_then_get(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        acc = await dao.create(
            user_id=uid,
            provider="google",
            provider_user_id="g-123",
            provider_email="a@b.com",
            provider_display_name="Alice",
        )

        assert acc.user_id == uid
        found = await dao.get_by_provider_user_id("google", "g-123")
        assert found is not None
        assert found.provider_user_id == "g-123"

    async def test_get_missing_returns_none(self, memory_session):
        dao = _dao(memory_session)
        assert await dao.get_by_provider_user_id("google", "missing") is None


class TestListByUser:
    async def test_list_returns_user_accounts(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        await dao.create(user_id=uid, provider="google", provider_user_id="g-1")
        await dao.create(user_id=uid, provider="github", provider_user_id="gh-1")

        accounts = await dao.list_by_user(uid)
        assert len(accounts) == 2
        providers = {a.provider for a in accounts}
        assert providers == {"google", "github"}

    async def test_list_empty_when_none(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        assert await dao.list_by_user(uid) == []


class TestDelete:
    async def test_delete_existing_returns_true(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        await dao.create(user_id=uid, provider="google", provider_user_id="g-1")

        assert await dao.delete(uid, "google") is True
        assert await dao.list_by_user(uid) == []

    async def test_delete_missing_returns_false(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        assert await dao.delete(uid, "google") is False


class TestExistsChecks:
    async def test_exists_by_provider_user_id(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        await dao.create(user_id=uid, provider="google", provider_user_id="g-1")

        assert await dao.exists_by_provider_user_id("google", "g-1") is True
        assert await dao.exists_by_provider_user_id("google", "other") is False

    async def test_exists_by_user_and_provider(self, memory_session):
        uid = await _seed_user(memory_session)
        dao = _dao(memory_session)
        await dao.create(user_id=uid, provider="google", provider_user_id="g-1")

        assert await dao.exists_by_user_and_provider(uid, "google") is True
        assert await dao.exists_by_user_and_provider(uid, "github") is False
