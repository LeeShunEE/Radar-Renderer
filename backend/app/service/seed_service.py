"""测试环境常驻账户 seed。

仅当 ``settings.testing`` 为 True 时，在应用启动阶段幂等地创建一个固定的测试
账户（用户名 / 邮箱 / 密码见 ``settings.dev_seed_*``）。生产环境（testing=False）
绝不创建，保证该账户"仅测试环境存在"。
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.dao.user_dao import UserDAO

logger = logging.getLogger(__name__)


async def seed_dev_account(session: AsyncSession) -> None:
    """幂等创建测试环境常驻账户。

    仅在 ``settings.testing`` 为 True 时生效；生产环境（testing=False）直接返回，
    不落任何账户——这是"仅测试环境存在"的安全防线。已存在同名用户名或邮箱时跳过，
    不覆盖既有账户，保证可重复启动。

    Args:
        session: 数据库会话
    """
    # 安全防线：生产环境绝不创建测试账户（调用方通常也已按 testing 门控，双重保险）
    if not settings.testing:
        return

    dao = UserDAO(session)
    username = settings.dev_seed_username
    email = settings.dev_seed_email
    # 幂等：用户名或邮箱已存在都跳过，避免重复插入与唯一约束冲突
    if await dao.exists_by_username(username) or await dao.exists_by_email(email):
        logger.info(f"测试账户 username={username} 已存在，跳过 seed")
        return

    password = settings.dev_seed_password_secret_string.get_secret_value()
    await dao.create(
        username=username,
        email=email,
        password_hash=hash_password(password),
        is_verified=True,
    )
    logger.info(f"已 seed 测试环境常驻账户 username={username}")
