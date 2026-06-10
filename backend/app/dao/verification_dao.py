"""验证码数据访问对象。

DAO 层在 ``VerificationCodeORM`` 与领域模型之间转换，
对上层只暴露领域模型，``*ORM`` 不越出本层。
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dao.orm import VerificationCodeORM


class VerificationCodeDAO:
    """验证码表数据访问。"""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        email: str,
        code: str,
        purpose: str,
        expires_at: datetime,
    ) -> VerificationCodeORM:
        """创建验证码记录。"""
        orm = VerificationCodeORM(
            email=email,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
        )
        self._session.add(orm)
        await self._session.commit()
        await self._session.refresh(orm)
        return orm

    async def get_latest_unused(
        self, email: str, purpose: str
    ) -> VerificationCodeORM | None:
        """获取最新的未使用验证码（用于校验）。"""
        stmt = (
            select(VerificationCodeORM)
            .where(
                VerificationCodeORM.email == email,
                VerificationCodeORM.purpose == purpose,
                VerificationCodeORM.used == False,
                VerificationCodeORM.expires_at > datetime.now(tz=UTC),
            )
            .order_by(VerificationCodeORM.created_at.desc())
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def mark_used(self, orm: VerificationCodeORM) -> None:
        """标记验证码已使用。"""
        orm.used = True
        await self._session.commit()

    async def get_latest_for_cooldown_check(
        self, email: str, purpose: str
    ) -> VerificationCodeORM | None:
        """获取最新的验证码（用于冷却时间检查，包括已过期的）。"""
        stmt = (
            select(VerificationCodeORM)
            .where(
                VerificationCodeORM.email == email,
                VerificationCodeORM.purpose == purpose,
            )
            .order_by(VerificationCodeORM.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def delete_expired(self) -> int:
        """删除所有已过期的验证码（清理任务）。"""
        stmt = select(VerificationCodeORM).where(
            VerificationCodeORM.expires_at < datetime.now(tz=UTC)
        )
        orms = (await self._session.execute(stmt)).scalars().all()
        count = len(orms)
        for orm in orms:
            await self._session.delete(orm)
        await self._session.commit()
        return count