"""FastAPI 公共依赖。"""

from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.exceptions import AuthError
from app.core.security import TokenType, decode_token
from app.models.user import User
from app.service.user_service import UserService

_bearer = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    session: SessionDep,
) -> User:
    """从 Bearer access token 解析当前用户。"""
    if credentials is None:
        raise AuthError("未提供凭证")
    payload = decode_token(credentials.credentials, expected_type=TokenType.ACCESS)
    user_id = int(payload["sub"])
    return await UserService(session).get_by_id(user_id)


CurrentUserDep = Annotated[User, Depends(get_current_user)]


async def verify_render_callback_token(
    x_render_callback_token: Annotated[str | None, Header()] = None,
) -> None:
    """校验 worker 进度回调的共享密钥（非用户态：worker 不是用户，用密钥而非 JWT）。"""
    expected = settings.render_callback_token_secret_string.get_secret_value()
    if x_render_callback_token != expected:
        raise AuthError("渲染回调令牌无效")


__all__ = [
    "CurrentUserDep",
    "SessionDep",
    "get_current_user",
    "get_session",
    "verify_render_callback_token",
]
