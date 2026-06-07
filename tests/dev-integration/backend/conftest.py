"""dev-integration 阶段特化 fixture。

用真实 SQLite 本地文件库（§4.1 允许）跑通 router→service→dao 链路，
通过 dependency override 把应用会话指向测试库。
"""

import asyncio
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_session
from app.core.config import settings
from app.dao.orm import Base
from app.main import app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    db_url = f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}"
    engine = create_async_engine(db_url)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def _init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # 建表与后续请求在不同事件循环：建表后 dispose，请求循环按需新建连接。
    asyncio.run(_init())
    asyncio.run(engine.dispose())

    async def _override_session() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


@pytest.fixture(autouse=True)
def _isolate_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """把每个测试的文件存储隔离到临时目录。"""
    monkeypatch.setattr(settings, "storage_root", tmp_path / "storage")


@pytest.fixture(autouse=True)
def _isolate_queue(monkeypatch: pytest.MonkeyPatch) -> None:
    """关闭队列自动启动并清空内存态（dev-integration 不触发真实渲染）。"""
    monkeypatch.setattr(settings, "render_queue_autostart", False)
    from app.service.queue_service import render_queue

    render_queue.reset()


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    """注册并登录一个用户，返回带 access token 的请求头。"""
    reg = {"username": "alice", "email": "alice@example.com", "password": "password123"}
    client.post("/api/v1/auth/register", json=reg)
    tokens = client.post(
        "/api/v1/auth/login",
        json={"username": "alice", "password": "password123"},
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
