"""core/security.py 单元测试。"""

import pytest

from app.core.exceptions import AuthError
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHash:
    def test_hash_is_not_plaintext(self):
        hashed = hash_password("s3cret-pass")
        assert hashed != "s3cret-pass"
        assert hashed.startswith("$argon2")

    def test_verify_correct_password(self):
        hashed = hash_password("s3cret-pass")
        assert verify_password("s3cret-pass", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("s3cret-pass")
        assert verify_password("wrong", hashed) is False

    def test_verify_invalid_hash_returns_false(self):
        assert verify_password("whatever", "not-a-hash") is False


class TestToken:
    def test_access_token_roundtrip(self):
        token = create_access_token("42")
        payload = decode_token(token, expected_type=TokenType.ACCESS)
        assert payload["sub"] == "42"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self):
        token = create_refresh_token("7")
        payload = decode_token(token, expected_type=TokenType.REFRESH)
        assert payload["sub"] == "7"

    def test_wrong_token_type_raises(self):
        access = create_access_token("1")
        with pytest.raises(AuthError):
            decode_token(access, expected_type=TokenType.REFRESH)

    def test_garbage_token_raises(self):
        with pytest.raises(AuthError):
            decode_token("not.a.jwt")
