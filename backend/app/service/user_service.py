"""用户查询服务。"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UserNotFoundError
from app.dao.user_dao import UserDAO
from app.models.user import User


class UserService:
    """用户读取相关用例。"""

    def __init__(self, session: AsyncSession) -> None:
        self._dao = UserDAO(session)

    async def get_by_id(self, user_id: int) -> User:
        """按 id 取用户；不存在时抛业务异常（空有业务含义，§12.5）。"""
        user = await self._dao.get_by_id(user_id)
        if user is None:
            raise UserNotFoundError(f"用户不存在: id={user_id}")
        return user
