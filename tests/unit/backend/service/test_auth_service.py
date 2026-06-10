"""service/auth_service.py 单元测试（DAO 全 mock）。"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import AuthError, UserExistsError
from app.core.security import hash_password
from app.models.user import User, UserCredentials
from app.service.auth_service import AuthService


def _make_service(dao: AsyncMock, verification_dao: AsyncMock = None) -> AuthService:
    service = AuthService.__new__(AuthService)
    service._dao = dao
    if verification_dao:
        service._verification_dao = verification_dao
    return service


def _user() -> User:
    return User(
        id=1,
        username="alice",
        email="alice@example.com",
        is_verified=True,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


class TestRegisterWithPassword:
    async def test_register_with_password_creates_user(self):
        """register_with_password 创建用户。"""
        dao = AsyncMock()
        dao.exists.return_value = False
        dao.create.return_value = _user()
        service = _make_service(dao)

        user = await service.register_with_password(
            username="alice", email="alice@example.com", password="password123"
        )

        assert user.username == "alice"
        # 落库的是哈希，而非明文
        _, kwargs = dao.create.call_args
        assert kwargs["password_hash"] != "password123"

    async def test_register_with_password_conflict_raises(self):
        """register_with_password 用户已存在时抛异常。"""
        dao = AsyncMock()
        dao.exists.return_value = True
        service = _make_service(dao)

        with pytest.raises(UserExistsError):
            await service.register_with_password(
                username="alice", email="alice@example.com", password="password123"
            )
        dao.create.assert_not_called()


class TestVerifyAndRegister:
    async def test_verify_and_register_success(self):
        """verify_and_register 验证码正确后创建用户。"""
        from app.dao.orm import VerificationCodeORM

        # Mock verification DAO
        verification_dao = AsyncMock()
        mock_orm = MagicMock(spec=VerificationCodeORM)
        mock_orm.code = "123456"
        mock_orm.expires_at = datetime.now(tz=UTC) + timedelta(minutes=10)
        verification_dao.get_latest_unused.return_value = mock_orm
        verification_dao.mark_used = AsyncMock()

        # Mock user DAO
        dao = AsyncMock()
        dao.exists_by_email.return_value = False
        dao.create.return_value = User(
            id=1,
            username=None,
            email="alice@example.com",
            is_verified=True,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        service = _make_service(dao, verification_dao)

        user = await service.verify_and_register(
            email="alice@example.com", code="123456"
        )

        assert user.email == "alice@example.com"
        assert user.username is None
        assert user.is_verified is True

    async def test_verify_and_register_invalid_code_raises(self):
        """verify_and_register 验证码错误时抛异常。"""
        from app.core.exceptions import VerificationCodeInvalidError
        from app.dao.orm import VerificationCodeORM

        verification_dao = AsyncMock()
        mock_orm = MagicMock(spec=VerificationCodeORM)
        mock_orm.code = "123456"
        mock_orm.expires_at = datetime.now(tz=UTC) + timedelta(minutes=10)
        verification_dao.get_latest_unused.return_value = mock_orm

        dao = AsyncMock()
        service = _make_service(dao, verification_dao)

        with pytest.raises(VerificationCodeInvalidError):
            await service.verify_and_register(
                email="alice@example.com", code="wrong_code"
            )

    async def test_verify_and_register_email_exists_raises(self):
        """verify_and_register 邮箱已注册时抛异常。"""
        from app.dao.orm import VerificationCodeORM

        verification_dao = AsyncMock()
        mock_orm = MagicMock(spec=VerificationCodeORM)
        mock_orm.code = "123456"
        mock_orm.expires_at = datetime.now(tz=UTC) + timedelta(minutes=10)
        verification_dao.get_latest_unused.return_value = mock_orm
        verification_dao.mark_used = AsyncMock()

        dao = AsyncMock()
        dao.exists_by_email.return_value = True
        service = _make_service(dao, verification_dao)

        with pytest.raises(UserExistsError):
            await service.verify_and_register(
                email="alice@example.com", code="123456"
            )


class TestAuthenticate:
    async def test_authenticate_by_username_success(self):
        """authenticate 用户名登录成功。"""
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

    async def test_authenticate_by_email_success(self):
        """authenticate 邮箱登录成功。"""
        dao = AsyncMock()
        dao.get_credentials_by_email.return_value = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=hash_password("password123"),
        )
        dao.get_by_id.return_value = _user()
        service = _make_service(dao)

        user = await service.authenticate(email="alice@example.com", password="password123")
        assert user.id == 1

    async def test_authenticate_unknown_user_raises(self):
        """authenticate 用户不存在时抛异常。"""
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = None
        service = _make_service(dao)

        with pytest.raises(AuthError):
            await service.authenticate(username="ghost", password="x")

    async def test_authenticate_wrong_password_raises(self):
        """authenticate 密码错误时抛异常。"""
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=hash_password("correct"),
        )
        service = _make_service(dao)

        with pytest.raises(AuthError):
            await service.authenticate(username="alice", password="wrong")

    async def test_authenticate_no_password_raises(self):
        """authenticate 用户无密码时抛异常（OAuth 用户）。"""
        dao = AsyncMock()
        dao.get_credentials_by_username.return_value = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=None,
        )
        service = _make_service(dao)

        with pytest.raises(AuthError) as exc_info:
            await service.authenticate(username="alice", password="password123")
        assert "未设置密码" in str(exc_info.value.message)


class TestSetUsername:
    async def test_set_username_success(self):
        """set_username 成功设置用户名。"""
        dao = AsyncMock()
        dao.exists_by_username.return_value = False
        dao.set_username.return_value = User(
            id=1,
            username="alice",
            email="alice@example.com",
            is_verified=True,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        service = _make_service(dao)

        user = await service.set_username(1, "alice")
        assert user.username == "alice"

    async def test_set_username_conflict_raises(self):
        """set_username 用户名已存在时抛异常。"""
        dao = AsyncMock()
        dao.exists_by_username.return_value = True
        service = _make_service(dao)

        with pytest.raises(UserExistsError):
            await service.set_username(1, "alice")


class TestSetPassword:
    async def test_set_password_success(self):
        """set_password 成功设置密码。"""
        dao = AsyncMock()
        dao.set_password.return_value = _user()
        service = _make_service(dao)

        user = await service.set_password(1, "password123")
        assert user.id == 1


# === 旧测试（兼容） ===

class TestRegister:
    """旧 register 方法测试（兼容 register_with_password）。"""

    async def test_register_creates_user(self):
        dao = AsyncMock()
        dao.exists.return_value = False
        dao.create.return_value = _user()
        service = _make_service(dao)

        user = await service.register_with_password(
            username="alice", email="alice@example.com", password="password123"
        )

        assert user.username == "alice"
        _, kwargs = dao.create.call_args
        assert kwargs["password_hash"] != "password123"
