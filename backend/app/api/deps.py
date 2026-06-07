"""FastAPI 公共依赖。"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

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

__all__ = ["CurrentUserDep", "SessionDep", "get_current_user", "get_session"]
