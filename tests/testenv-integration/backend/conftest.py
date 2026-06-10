"""testenv-integration backend conftest。

提供真实数据库连接 fixture（配置由测试系统注入）。
"""

import os

import pytest
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.dao.orm import Base


@pytest.fixture(scope="session")
async def real_db_engine():
    """真实数据库引擎（配置由环境变量注入）。

    从环境变量 TEST_DB_URL 读取连接串，若未配置则跳过整个 testenv 测试套。
    """
    db_url = os.getenv("TEST_DB_URL")
    if not db_url:
        pytest.skip("TEST_DB_URL 未配置，跳过 testenv 测试")
        return  # never reached, for type checkers

    engine = create_async_engine(db_url, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def real_db_session(real_db_engine) -> AsyncSession:
    """真实数据库会话（每测试独立事务）。

    每个测试运行在独立事务中，测试结束后自动回滚，
    确保 testenv 测试之间互不污染。
    """
    async_session = async_sessionmaker(real_db_engine, expire_on_commit=False)
    async with async_session() as session:
        async with session.begin():
            yield session
            # 测试结束自动回滚