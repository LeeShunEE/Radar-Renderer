"""Unit 阶段特化 fixture。"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.dao.orm import Base


@pytest.fixture
def mock_session():
    """Unit 阶段基础 mock session。"""
    return AsyncMock()


@pytest.fixture
async def memory_session() -> AsyncIterator[AsyncSession]:
    """内存 SQLite 会话（进程内，§4.1 允许），用于 DAO 真实 SQL 路径覆盖。

    用 StaticPool 保证 :memory: 单连接，使建表与查询共享同一内存库。
    """
    from sqlalchemy.pool import StaticPool

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()
