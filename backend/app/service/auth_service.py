"""认证服务：注册与登录校验。

入站时在 service 内显式构造领域模型；token 签发由调用方（路由）用 core.security 完成。
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError, UserExistsError
from app.core.security import hash_password, verify_password
from app.dao.user_dao import UserDAO
from app.models.user import User


class AuthService:
    """注册 / 认证用例。"""

    def __init__(self, session: AsyncSession) -> None:
        self._dao = UserDAO(session)

    async def register(self, *, username: str, email: str, password: str) -> User:
        """注册新用户；用户名或邮箱已存在时抛业务异常。"""
        if await self._dao.exists(username=username, email=email):
            raise UserExistsError("用户名或邮箱已被占用")
        return await self._dao.create(
            username=username,
            email=email,
            password_hash=hash_password(password),
        )

    async def authenticate(self, *, username: str, password: str) -> User:
        """校验账号口令，成功返回用户；失败抛 ``AuthError``。"""
        credentials = await self._dao.get_credentials_by_username(username)
        if credentials is None:
            raise AuthError("用户名或密码错误")
        ok = verify_password(
            password,
            credentials.password_hash_secret_string.get_secret_value(),
        )
        if not ok:
            raise AuthError("用户名或密码错误")
        user = await self._dao.get_by_id(credentials.user_id)
        if user is None:  # 极端竞态：凭据存在但用户被删
            raise AuthError("用户名或密码错误")
        return user
