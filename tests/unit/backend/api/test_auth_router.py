"""auth_router 单元测试：reset-password 接口契约（TestClient + 全 mock，无进程外 I/O）。

SessionDep 用 mock 覆盖，AuthService.reset_password 被 patch，断言异常→HTTP 映射。
"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_session
from app.core.exceptions import UserNotFoundError, VerificationCodeInvalidError
from app.main import app
from app.models.user import User


def _user() -> User:
    from datetime import UTC, datetime

    return User(
        id=1,
        username=None,
        email="alice@example.com",
        is_verified=True,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[TestClient]:
    """TestClient，session 覆盖为 mock（unit 阶段不触达真实 DB）。"""
    from app.core.config import settings
    from app.service.queue_service import render_queue

    # 关闭队列自动启动：lifespan 否则会用真实 session 查 render_tasks 表
    monkeypatch.setattr(settings, "render_queue_autostart", False)
    render_queue.reset()

    async def _override_session() -> AsyncIterator[MagicMock]:
        yield AsyncMock()

    app.dependency_overrides[get_session] = _override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestResetPasswordEndpoint:
    """POST /auth/reset-password 接口契约。"""

    def test_reset_password_returns_token(self, client: TestClient):
        """验证码正确 → 201 + token。"""
        mock_service = MagicMock()
        mock_service.reset_password = AsyncMock(return_value=_user())

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr("app.api.v1.auth_router.AuthService", lambda _s: mock_service)
            resp = client.post(
                "/api/v1/auth/reset-password",
                json={
                    "email": "alice@example.com",
                    "code": "123456",
                    "new_password": "newpass123",
                },
            )

        assert resp.status_code == 201
        body = resp.json()
        assert body["token_type"] == "bearer"
        assert body["access_token"]
        assert body["refresh_token"]
        mock_service.reset_password.assert_awaited_once()

    def test_reset_password_invalid_code_400(self, client: TestClient):
        """验证码错误 → 400。"""
        mock_service = MagicMock()
        mock_service.reset_password = AsyncMock(
            side_effect=VerificationCodeInvalidError("验证码错误")
        )

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr("app.api.v1.auth_router.AuthService", lambda _s: mock_service)
            resp = client.post(
                "/api/v1/auth/reset-password",
                json={
                    "email": "alice@example.com",
                    "code": "000000",
                    "new_password": "newpass123",
                },
            )

        assert resp.status_code == 400
        assert resp.json()["code"] == "verification_code_invalid"

    def test_reset_password_user_not_found_404(self, client: TestClient):
        """邮箱未注册 → 404。"""
        mock_service = MagicMock()
        mock_service.reset_password = AsyncMock(
            side_effect=UserNotFoundError("用户不存在")
        )

        with pytest.MonkeyPatch.context() as mp:
            mp.setattr("app.api.v1.auth_router.AuthService", lambda _s: mock_service)
            resp = client.post(
                "/api/v1/auth/reset-password",
                json={
                    "email": "ghost@example.com",
                    "code": "123456",
                    "new_password": "newpass123",
                },
            )

        assert resp.status_code == 404
        assert resp.json()["code"] == "user_not_found"
