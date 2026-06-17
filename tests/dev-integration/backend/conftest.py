"""dev-integration 阶段特化 fixture。

用真实 SQLite 本地文件库（§4.1 允许）跑通 router→service→dao 链路，
通过 dependency override 把应用会话指向测试库。
"""

import asyncio
from collections.abc import AsyncGenerator, Callable, Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import get_session
from app.core.config import settings
from app.dao.orm import Base
from app.main import app
from app.service.email_service import EmailService


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
def captured_codes(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """绕开 Resend，捕获 send-code 实际生成的验证码。

    EmailService 在无 Resend key 时 __init__ 会抛错；这里把它替换为无害实现，
    并记录每次 send_verification_code 的 code 实参，使测试能走通真实的
    send-code → register（邮箱+验证码）链路。
    """
    codes: list[str] = []

    def _noop_init(self: EmailService) -> None:
        pass

    async def _capture_send(
        self: EmailService, email: str, code: str, purpose: str
    ) -> None:
        codes.append(code)

    monkeypatch.setattr(EmailService, "__init__", _noop_init)
    monkeypatch.setattr(EmailService, "send_verification_code", _capture_send)
    return codes


@pytest.fixture
def register_user(
    client: TestClient, captured_codes: list[str]
) -> Callable[..., dict]:
    """返回一个「邮箱验证码注册并自动登录」的辅助函数，产出 TokenResponse。

    邮箱验证码注册的用户无密码、无用户名，token 直接来自 register 响应（自动登录）。
    """

    def _register(email: str = "alice@example.com") -> dict:
        client.post(
            "/api/v1/auth/send-code", json={"email": email, "purpose": "register"}
        )
        code = captured_codes[-1]
        resp = client.post(
            "/api/v1/auth/register", json={"email": email, "code": code}
        )
        return resp.json()

    return _register


@pytest.fixture
def auth_headers(register_user: Callable[..., dict]) -> dict[str, str]:
    """注册一个用户并返回带 access token 的请求头。"""
    tokens = register_user()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
