"""service/auth_service.py 单元测试（DAO 全 mock）。"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import AuthError, UserExistsError
from app.core.security import hash_password
from app.models.user import User, UserCredentials
from app.service.auth_service import AuthService


def _make_service(dao: AsyncMock) -> AuthService:
    service = AuthService.__new__(AuthService)
    service._dao = dao  # 直接注入 mock DAO，绕过会话构造
    return service


def _user() -> User:
    return User(
        id=1,
        username="alice",
        email="alice@example.com",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


class TestRegister:
    async def test_register_creates_user(self):
        dao = AsyncMock()
        dao.exists.return_value = False
        dao.create.return_value = _user()
        service = _make_service(dao)

        user = await service.register(
            username="alice", email="alice@example.com", password="password123"
        )

        assert user.username == "alice"
        # 落库的是哈希，而非明文
        _, kwargs = dao.create.call_args
        assert kwargs["password_hash"] != "password123"

    async def test_register_conflict_raises(self):
        dao = AsyncMock()
        dao.exists.return_value = True
        service = _make_service(dao)

        with pytest.raises(UserExistsError):
            await service.register(
                username="alice", email="alice@example.com", password="password123"
            )
        dao.create.assert_not_called()


class TestAuthenticate:
    async def test_authenticate_success(self):
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=hash_password("password123"),
        )
        dao.get_by_id.return_value = _user()
        service = _make_service(dao)

        user = await service.authenticate(username="alice", password="password123")
        assert user.id == 1

    async def test_authenticate_unknown_user_raises(self):
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = None
        service = _make_service(dao)

        with pytest.raises(AuthError):
            await service.authenticate(username="ghost", password="x")

    async def test_authenticate_wrong_password_raises(self):
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=hash_password("correct"),
        )
        service = _make_service(dao)

        with pytest.raises(AuthError):
            await service.authenticate(username="alice", password="wrong")
