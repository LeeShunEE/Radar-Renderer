"""用户数据访问对象。

DAO 层在 ``UserORM`` 与领域模型（``User`` / ``UserCredentials``）之间转换，
对上层只暴露领域模型，``*ORM`` 不越出本层。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.orm import UserORM
from app.models.user import User, UserCredentials


def _to_user(orm: UserORM) -> User:
    return User(
        id=orm.id,
        username=orm.username,
        email=orm.email,
        created_at=orm.created_at,
    )


class UserDAO:
    """用户表数据访问。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, *, username: str, email: str, password_hash: str) -> User:
        orm = UserORM(username=username, email=email, password_hash=password_hash)
        self._session.add(orm)
        await self._session.commit()
        await self._session.refresh(orm)
        return _to_user(orm)

    async def get_by_id(self, user_id: int) -> User | None:
        orm = await self._session.get(UserORM, user_id)
        return _to_user(orm) if orm is not None else None

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(UserORM).where(UserORM.username == username)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return _to_user(orm) if orm is not None else None

    async def exists(self, *, username: str, email: str) -> bool:
        stmt = select(UserORM.id).where(
            (UserORM.username == username) | (UserORM.email == email)
        )
        return (await self._session.execute(stmt)).first() is not None

    async def get_credentials_by_username(
        self, username: str
    ) -> UserCredentials | None:
        stmt = select(UserORM).where(UserORM.username == username)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return None
        return UserCredentials(
            user_id=orm.id,
            username=orm.username,
            password_hash_secret_string=orm.password_hash,
        )
