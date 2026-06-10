"""UserDAO 单元测试。"""

import pytest
from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock

from app.dao.user_dao import UserDAO, _to_user
from app.dao.orm import UserORM
from app.models.user import User, UserCredentials
from pydantic import SecretStr


@pytest.fixture
def mock_session() -> AsyncMock:
    """Mock AsyncSession。"""
    return AsyncMock()


@pytest.fixture
def dao(mock_session: AsyncMock) -> UserDAO:
    """DAO 实例。"""
    return UserDAO(mock_session)


class TestToUser:
    """_to_user 转换测试。"""

    def test_converts_orm_to_user(self) -> None:
        """ORM 正确转换为 User 领域模型。"""
        orm = MagicMock(spec=UserORM)
        orm.id = 1
        orm.username = "alice"
        orm.email = "alice@example.com"
        orm.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        user = _to_user(orm)
        assert user.id == 1
        assert user.username == "alice"
        assert user.email == "alice@example.com"
        assert user.created_at == datetime(2026, 1, 1, tzinfo=UTC)


class TestCreate:
    """create 方法测试。"""

    async def test_create_returns_user(
        self, mock_session: AsyncMock
    ) -> None:
        """create 返回 User。"""
        # 创建一个预期的领域模型
        expected_user = User(
            id=1,
            username="alice",
            email="alice@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )

        # Mock session 操作
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()

        # Patch _to_user 以返回预期的领域模型
        import app.dao.user_dao as dao_module
        with pytest.MonkeyPatch.context() as m:
            m.setattr(dao_module, "_to_user", lambda _: expected_user)
            dao = UserDAO(mock_session)
            user = await dao.create(
                username="alice",
                email="alice@example.com",
                password_hash="hashed_password",
            )

        mock_session.add.assert_called_once()
        mock_session.commit.assert_called_once()
        mock_session.refresh.assert_called_once()

        assert user.username == "alice"
        assert user.email == "alice@example.com"


class TestGetById:
    """get_by_id 方法测试。"""

    async def test_get_by_id_returns_user_when_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_by_id 返回 User 当用户存在。"""
        orm = MagicMock()
        orm.id = 1
        orm.username = "alice"
        orm.email = "alice@example.com"
        orm.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        mock_session.get = AsyncMock(return_value=orm)

        user = await dao.get_by_id(1)
        assert user is not None
        assert user.id == 1
        assert user.username == "alice"

    async def test_get_by_id_returns_none_when_not_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_by_id 返回 None 当用户不存在。"""
        mock_session.get = AsyncMock(return_value=None)

        user = await dao.get_by_id(999)
        assert user is None


class TestGetByUsername:
    """get_by_username 方法测试。"""

    async def test_get_by_username_returns_user_when_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_by_username 返回 User 当用户存在。"""
        orm = MagicMock()
        orm.id = 1
        orm.username = "alice"
        orm.email = "alice@example.com"
        orm.created_at = datetime(2026, 1, 1, tzinfo=UTC)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = orm
        mock_session.execute = AsyncMock(return_value=mock_result)

        user = await dao.get_by_username("alice")
        assert user is not None
        assert user.username == "alice"

    async def test_get_by_username_returns_none_when_not_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_by_username 返回 None 当用户不存在。"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        user = await dao.get_by_username("notfound")
        assert user is None


class TestExists:
    """exists 方法测试。"""

    async def test_exists_returns_true_when_username_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """用户名存在时返回 True。"""
        mock_result = MagicMock()
        mock_result.first.return_value = (1,)  # 返回一个 ID tuple
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await dao.exists(username="alice", email="other@example.com")
        assert result is True

    async def test_exists_returns_true_when_email_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """邮箱存在时返回 True。"""
        mock_result = MagicMock()
        mock_result.first.return_value = (1,)  # 返回一个 ID tuple
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await dao.exists(username="other", email="alice@example.com")
        assert result is True

    async def test_exists_returns_false_when_not_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """用户名和邮箱都不存在时返回 False。"""
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        result = await dao.exists(username="notfound", email="notfound@example.com")
        assert result is False


class TestGetCredentialsByUsername:
    """get_credentials_by_username 方法测试。"""

    async def test_get_credentials_returns_credentials_when_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_credentials_by_username 返回凭据当用户存在。"""
        orm = MagicMock()
        orm.id = 1
        orm.username = "alice"
        orm.password_hash = "hashed_password"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = orm
        mock_session.execute = AsyncMock(return_value=mock_result)

        creds = await dao.get_credentials_by_username("alice")
        assert creds is not None
        assert creds.user_id == 1
        assert creds.username == "alice"
        assert creds.password_hash_secret_string.get_secret_value() == "hashed_password"

    async def test_get_credentials_returns_none_when_not_found(
        self, dao: UserDAO, mock_session: AsyncMock
    ) -> None:
        """get_credentials_by_username 返回 None 当用户不存在。"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        creds = await dao.get_credentials_by_username("notfound")
        assert creds is None