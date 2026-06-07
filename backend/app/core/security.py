"""口令哈希与 JWT 编解码。

口令用 argon2 哈希；JWT 用对称密钥（``jwt_secret_string``，SecretStr）签发，
需要明文时才 ``get_secret_value()`` 解封（见 CLAUDE.md §12.8）。
"""

from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import settings
from app.core.exceptions import AuthError

_password_hasher = PasswordHasher()


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


def hash_password(password: str) -> str:
    """返回口令的 argon2 哈希。"""
    return _password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """校验明文口令与哈希是否匹配。"""
    try:
        return _password_hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def _create_token(subject: str, token_type: TokenType, expires_minutes: int) -> str:
    expire = datetime.now(tz=UTC) + timedelta(minutes=expires_minutes)
    payload = {"sub": subject, "type": token_type.value, "exp": expire}
    return jwt.encode(
        payload,
        settings.jwt_secret_string.get_secret_value(),
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(subject: str) -> str:
    """签发 access token（subject 一般为用户 id）。"""
    return _create_token(subject, TokenType.ACCESS, settings.jwt_expire_minutes)


def create_refresh_token(subject: str) -> str:
    """签发 refresh token。"""
    return _create_token(
        subject, TokenType.REFRESH, settings.jwt_refresh_expire_minutes
    )


def decode_token(token: str, *, expected_type: TokenType = TokenType.ACCESS) -> dict[str, Any]:
    """解码并校验 JWT，返回 payload。

    Args:
        token: 待解码的 JWT 字符串。
        expected_type: 期望的 token 类型（access/refresh）。

    Returns:
        解码后的 payload（``dict[str, Any]``，第三方库返回结构无法收窄）。

    Raises:
        AuthError: token 无效、过期或类型不符。
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_secret_string.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as e:
        raise AuthError("无效或过期的凭证") from e

    if payload.get("type") != expected_type.value:
        raise AuthError("凭证类型不符")
    return payload
