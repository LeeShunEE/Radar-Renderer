"""User 模型单元测试。"""

import pytest
from datetime import datetime, UTC

from app.models.user import User, UserCredentials
from pydantic import SecretStr


class TestUserModel:
    """User 领域模型测试。"""

    def test_model_fields(self) -> None:
        """模型字段存在且类型正确。"""
        user = User(
            id=1,
            username="alice",
            email="alice@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert user.id == 1
        assert user.username == "alice"
        assert user.email == "alice@example.com"
        assert isinstance(user.created_at, datetime)

    def test_model_is_frozen(self) -> None:
        """模型不可变（frozen=True）。"""
        user = User(
            id=1,
            username="alice",
            email="alice@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        with pytest.raises(Exception):
            user.username = "bob"

    def test_username_min_length(self) -> None:
        """username 最小长度为 3。"""
        with pytest.raises(Exception):  # pydantic ValidationError
            User(
                id=1,
                username="ab",  # 少于 3 字符
                email="test@example.com",
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )

    def test_username_max_length(self) -> None:
        """username 最大长度为 64。"""
        with pytest.raises(Exception):  # pydantic ValidationError
            User(
                id=1,
                username="a" * 65,  # 超过 64 字符
                email="test@example.com",
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )

    def test_username_valid_length(self) -> None:
        """username 有效长度范围。"""
        # 3 字符
        user = User(
            id=1,
            username="abc",
            email="test@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert user.username == "abc"
        # 64 字符
        user = User(
            id=2,
            username="a" * 64,
            email="test@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert len(user.username) == 64

    def test_email_is_required(self) -> None:
        """email 为必填。"""
        user = User(
            id=1,
            username="alice",
            email="alice@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert user.email is not None

    def test_email_format_validation(self) -> None:
        """email 格式校验。"""
        # 有效 email
        user = User(
            id=1,
            username="alice",
            email="alice@example.com",
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert user.email == "alice@example.com"
        # 无效 email
        with pytest.raises(Exception):  # pydantic ValidationError
            User(
                id=1,
                username="alice",
                email="invalid-email",
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            )


class TestUserCredentialsModel:
    """UserCredentials 领域模型测试。"""

    def test_model_fields(self) -> None:
        """模型字段存在且类型正确。"""
        creds = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=SecretStr("hashed_password"),
        )
        assert creds.user_id == 1
        assert creds.username == "alice"
        assert isinstance(creds.password_hash_secret_string, SecretStr)

    def test_model_is_frozen(self) -> None:
        """模型不可变（frozen=True）。"""
        creds = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=SecretStr("hashed_password"),
        )
        with pytest.raises(Exception):
            creds.username = "bob"

    def test_password_hash_is_secret(self) -> None:
        """密码哈希为 SecretStr 类型。"""
        creds = UserCredentials(
            user_id=1,
            username="alice",
            password_hash_secret_string=SecretStr("hashed_password"),
        )
        # 需显式调用 get_secret_value() 才能获取明文
        assert creds.password_hash_secret_string.get_secret_value() == "hashed_password"