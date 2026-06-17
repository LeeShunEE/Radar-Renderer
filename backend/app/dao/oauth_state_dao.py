"""OAuth state（CSRF nonce）数据访问对象。

只暴露「创建」与「一次性消费」两个操作；``*ORM`` 不越出本层。
"""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.orm import OAuthStateORM
from app.utils.datetime import ensure_utc


class OAuthStateDAO:
    """OAuth state 表数据访问。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self, *, state: str, provider: str, expires_at: datetime
    ) -> None:
        """落库一条 state 记录。"""
        self._session.add(
            OAuthStateORM(state=state, provider=provider, expires_at=expires_at)
        )
        await self._session.commit()

    async def consume(self, *, state: str, provider: str, now: datetime) -> bool:
        """一次性消费 state：命中且未过期则删除并返回 True，否则 False。

        无论命中与否都删除该 state（命中即焚；不命中本就不存在），
        确保单个 state 不可重放。

        Args:
            state: 回调带回的 state
            provider: 期望的 provider（防止跨 provider 重用）
            now: 当前 UTC aware 时间

        Returns:
            校验是否通过
        """
        stmt = select(OAuthStateORM).where(OAuthStateORM.state == state)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()

        if orm is None:
            return False

        # 命中即焚，避免重放
        await self._session.execute(
            delete(OAuthStateORM).where(OAuthStateORM.id == orm.id)
        )
        await self._session.commit()

        if orm.provider != provider:
            return False
        return ensure_utc(orm.expires_at) >= now
