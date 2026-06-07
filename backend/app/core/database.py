"""数据库会话与引擎。

按 ``database_url`` 自动适配驱动：dev 用 ``sqlite+aiosqlite``，prod/testenv 用
``postgresql+asyncpg``。建表交给 Alembic 迁移（单测可对内存库用 ``create_all``）。
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

engine = create_async_engine(settings.database_url, future=True)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：提供一个 async 数据库会话。"""
    async with async_session_factory() as session:
        yield session
