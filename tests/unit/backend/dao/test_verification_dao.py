"""VerificationCodeDAO 单元测试（真实内存 SQLite，覆盖真实 SQL 路径）。"""

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.verification_dao import VerificationCodeDAO


def _dao(session: AsyncSession) -> VerificationCodeDAO:
    return VerificationCodeDAO(session)


async def _create(
    session: AsyncSession,
    *,
    email: str = "a@b.com",
    code: str = "123456",
    purpose: str = "register",
    expires_at: datetime | None = None,
) -> None:
    """直接构造一条验证码记录（绕过冷却，用于准备测试数据）。"""
    from app.dao.orm import VerificationCodeORM

    session.add(
        VerificationCodeORM(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at or datetime.now(tz=UTC) + timedelta(minutes=10),
        )
    )
    await session.commit()


class TestCreateAndGetLatestUnused:
    async def test_create_then_get_latest_unused(self, memory_session):
        """create 落库后可被 get_latest_unused 取回。"""
        dao = _dao(memory_session)
        await dao.create(
            email="a@b.com",
            code="123456",
            purpose="register",
            expires_at=datetime.now(tz=UTC) + timedelta(minutes=10),
        )

        orm = await dao.get_latest_unused("a@b.com", "register")
        assert orm is not None
        assert orm.code == "123456"

    async def test_get_latest_unused_filters_used(self, memory_session):
        """已使用的验证码不被返回。"""
        dao = _dao(memory_session)
        await dao.create(
            email="a@b.com",
            code="111111",
            purpose="register",
            expires_at=datetime.now(tz=UTC) + timedelta(minutes=10),
        )
        orm = await dao.get_latest_unused("a@b.com", "register")
        await dao.mark_used(orm)

        assert await dao.get_latest_unused("a@b.com", "register") is None

    async def test_get_latest_unused_filters_expired(self, memory_session):
        """过期验证码不被返回。"""
        dao = _dao(memory_session)
        await _create(
            memory_session, expires_at=datetime.now(tz=UTC) - timedelta(minutes=1)
        )
        assert await dao.get_latest_unused("a@b.com", "register") is None

    async def test_get_latest_unused_filters_purpose(self, memory_session):
        """不同 purpose 互不影响。"""
        dao = _dao(memory_session)
        await dao.create(
            email="a@b.com",
            code="111111",
            purpose="register",
            expires_at=datetime.now(tz=UTC) + timedelta(minutes=10),
        )
        assert await dao.get_latest_unused("a@b.com", "reset_password") is None

    async def test_get_latest_unused_returns_newest(self, memory_session):
        """旧码已用、新码未用时返回最新一条。"""
        dao = _dao(memory_session)
        await _create(memory_session, code="111111")
        # 旧码标记已用（生产中冷却 + 校验即焚，保证至多一条未使用）
        old = await dao.get_latest_unused("a@b.com", "register")
        await dao.mark_used(old)
        await _create(memory_session, code="222222")

        latest = await dao.get_latest_unused("a@b.com", "register")
        assert latest is not None
        assert latest.code == "222222"

    async def test_get_latest_unused_missing_returns_none(self, memory_session):
        dao = _dao(memory_session)
        assert await dao.get_latest_unused("nobody@b.com", "register") is None


class TestMarkUsed:
    async def test_mark_used_sets_used_flag(self, memory_session):
        dao = _dao(memory_session)
        await dao.create(
            email="a@b.com",
            code="123456",
            purpose="register",
            expires_at=datetime.now(tz=UTC) + timedelta(minutes=10),
        )
        orm = await dao.get_latest_unused("a@b.com", "register")
        await dao.mark_used(orm)

        assert orm.used is True


class TestGetLatestForCooldown:
    async def test_returns_latest_including_used_and_expired(self, memory_session):
        """冷却检查取最新（含已使用/已过期）。"""
        dao = _dao(memory_session)
        await _create(memory_session, code="111111")
        await _create(
            memory_session,
            code="222222",
            expires_at=datetime.now(tz=UTC) - timedelta(minutes=1),
        )

        orm = await dao.get_latest_for_cooldown_check("a@b.com", "register")
        assert orm is not None
        assert orm.code == "222222"


class TestDeleteExpired:
    async def test_delete_expired_removes_only_expired(self, memory_session):
        dao = _dao(memory_session)
        await _create(memory_session, code="keep")
        await _create(
            memory_session,
            code="gone",
            expires_at=datetime.now(tz=UTC) - timedelta(minutes=1),
        )

        deleted = await dao.delete_expired()
        assert deleted == 1
        # 未过期的仍在
        assert await dao.get_latest_unused("a@b.com", "register") is not None
