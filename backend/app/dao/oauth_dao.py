"""OAuth 账户数据访问对象。

DAO 层在 ``OAuthAccountORM`` 与领域模型 ``OAuthAccount`` 之间转换，
对上层只暴露领域模型，``*ORM`` 不越出本层。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.orm import OAuthAccountORM
from app.models.user import OAuthAccount


def _to_oauth_account(orm: OAuthAccountORM) -> OAuthAccount:
    return OAuthAccount(
        id=orm.id,
        user_id=orm.user_id,
        provider=orm.provider,
        provider_user_id=orm.provider_user_id,
        provider_email=orm.provider_email,
        provider_display_name=orm.provider_display_name,
        created_at=orm.created_at,
    )


class OAuthDAO:
    """OAuth 账户表数据访问。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        user_id: int,
        provider: str,
        provider_user_id: str,
        provider_email: str | None = None,
        provider_display_name: str | None = None,
    ) -> OAuthAccount:
        """创建 OAuth 账户绑定。"""
        orm = OAuthAccountORM(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_display_name=provider_display_name,
        )
        self._session.add(orm)
        await self._session.commit()
        await self._session.refresh(orm)
        return _to_oauth_account(orm)

    async def get_by_provider_user_id(
        self, provider: str, provider_user_id: str
    ) -> OAuthAccount | None:
        """通过 provider 和 provider_user_id 查找绑定。"""
        stmt = select(OAuthAccountORM).where(
            OAuthAccountORM.provider == provider,
            OAuthAccountORM.provider_user_id == provider_user_id,
        )
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return _to_oauth_account(orm) if orm is not None else None

    async def list_by_user(self, user_id: int) -> list[OAuthAccount]:
        """获取用户的所有 OAuth 账户绑定。"""
        stmt = select(OAuthAccountORM).where(OAuthAccountORM.user_id == user_id)
        orms = (await self._session.execute(stmt)).scalars().all()
        return [_to_oauth_account(orm) for orm in orms]

    async def delete(self, user_id: int, provider: str) -> bool:
        """删除用户的指定 provider OAuth 绑定。"""
        stmt = select(OAuthAccountORM).where(
            OAuthAccountORM.user_id == user_id,
            OAuthAccountORM.provider == provider,
        )
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return False
        await self._session.delete(orm)
        await self._session.commit()
        return True

    async def exists_by_provider_user_id(
        self, provider: str, provider_user_id: str
    ) -> bool:
        """检查 OAuth 账户是否已绑定。"""
        stmt = select(OAuthAccountORM.id).where(
            OAuthAccountORM.provider == provider,
            OAuthAccountORM.provider_user_id == provider_user_id,
        )
        return (await self._session.execute(stmt)).first() is not None

    async def exists_by_user_and_provider(self, user_id: int, provider: str) -> bool:
        """检查用户是否已绑定指定 provider。"""
        stmt = select(OAuthAccountORM.id).where(
            OAuthAccountORM.user_id == user_id,
            OAuthAccountORM.provider == provider,
        )
        return (await self._session.execute(stmt)).first() is not None