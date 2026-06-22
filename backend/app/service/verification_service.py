"""验证码服务：生成与校验。

支持注册和重置密码场景。
"""

import secrets
import string
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    VerificationCodeCooldownError,
    VerificationCodeExpiredError,
    VerificationCodeInvalidError,
)
from app.dao.verification_dao import VerificationCodeDAO
from app.utils.datetime import ensure_utc


class VerificationService:
    """验证码生成与校验。"""

    def __init__(self, session: AsyncSession) -> None:
        self._dao = VerificationCodeDAO(session)

    async def generate_code(self, email: str, purpose: str) -> str:
        """生成验证码并存储。

        Args:
            email: 目标邮箱
            purpose: 用途（"register" | "reset_password"）

        Returns:
            生成的验证码

        Raises:
            VerificationCodeCooldownError: 冷却时间内重复发送
        """
        # 检查冷却时间
        latest = await self._dao.get_latest_for_cooldown_check(email, purpose)
        if latest is not None:
            cooldown_end = ensure_utc(latest.created_at) + timedelta(
                seconds=settings.verification_code_cooldown_seconds
            )
            if datetime.now(tz=UTC) < cooldown_end:
                remaining = int((cooldown_end - datetime.now(tz=UTC)).total_seconds())
                raise VerificationCodeCooldownError(
                    f"请等待 {remaining} 秒后再发送验证码"
                )

        # 生成验证码
        code = self._generate_numeric_code(settings.verification_code_length)
        expires_at = datetime.now(tz=UTC) + timedelta(
            minutes=settings.verification_code_expire_minutes
        )

        # 存储
        await self._dao.create(email=email, code=code, purpose=purpose, expires_at=expires_at)

        return code

    async def verify_code(self, email: str, code: str, purpose: str) -> bool:
        """校验验证码。

        Args:
            email: 目标邮箱
            code: 用户输入的验证码
            purpose: 用途（"register" | "reset_password"）

        Returns:
            校验是否成功

        Raises:
            VerificationCodeInvalidError: 验证码无效或已使用
            VerificationCodeExpiredError: 验证码已过期
        """
        orm = await self._dao.get_latest_unused(email, purpose)

        if orm is None:
            raise VerificationCodeInvalidError("验证码无效或已使用")

        if orm.code != code:
            raise VerificationCodeInvalidError("验证码错误")

        if ensure_utc(orm.expires_at) < datetime.now(tz=UTC):
            raise VerificationCodeExpiredError("验证码已过期，请重新获取")

        # 标记已使用
        await self._dao.mark_used(orm)

        return True

    def _generate_numeric_code(self, length: int) -> str:
        """生成纯数字验证码。"""
        # 验证码属于安全凭据，须用密码学安全随机源（secrets），避免可预测。
        return "".join(secrets.choice(string.digits) for _ in range(length))

    async def get_latest_code(self, email: str, purpose: str) -> str | None:
        """获取最新未使用的验证码（仅测试用）。

        Args:
            email: 目标邮箱
            purpose: 用途（"register" | "reset_password"）

        Returns:
            最新未使用验证码，若无则 None
        """
        orm = await self._dao.get_latest_unused(email, purpose)
        return orm.code if orm else None