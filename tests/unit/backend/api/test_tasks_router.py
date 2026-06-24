"""tasks_router 单元测试：list_tasks 响应含 avg_fps（TestClient + mock render_queue）。

不走真实 DB；session 用 mock，render_queue.average_fps 被 patch。
"""

from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user, get_session
from app.core.config import settings
from app.main import app
from app.models.user import User


def _mock_user() -> User:
    """构造一个合法的 mock User 供 dependency override。"""
    from datetime import UTC, datetime

    return User(
        id=1,
        username=None,
        email="test@example.com",
        is_verified=True,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[TestClient]:
    """TestClient，session + current_user 覆盖为 mock（unit 阶段不触达真实 DB）。"""
    # 关闭队列自动启动：lifespan 否则会用真实 session 查 render_tasks 表
    monkeypatch.setattr(settings, "render_queue_autostart", False)
    from app.service.queue_service import render_queue

    render_queue.reset()

    async def _override_session() -> AsyncIterator[MagicMock]:
        yield AsyncMock()

    async def _override_user() -> User:
        return _mock_user()

    app.dependency_overrides[get_session] = _override_session
    app.dependency_overrides[get_current_user] = _override_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


class TestListTasksAvgFps:
    """GET /tasks 响应包含 avg_fps 字段。"""

    def test_avg_fps_null_when_no_samples(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """无样本时 avg_fps 为 null。"""
        # mock service 返回空列表
        mock_service = MagicMock()
        mock_service.list_for_user = AsyncMock(return_value=(0, []))
        monkeypatch.setattr("app.api.v1.tasks_router.TaskService", lambda _s, _q: mock_service)

        resp = client.get("/api/v1/tasks")
        assert resp.status_code == 200
        body = resp.json()
        assert body["avg_fps"] is None

    def test_avg_fps_value_with_samples(self, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """有样本时 avg_fps 返回滚动均值。"""
        mock_service = MagicMock()
        mock_service.list_for_user = AsyncMock(return_value=(0, []))
        monkeypatch.setattr("app.api.v1.tasks_router.TaskService", lambda _s, _q: mock_service)

        # 直接 patch render_queue.average_fps 返回 45.5
        from app.service.queue_service import render_queue

        monkeypatch.setattr(render_queue, "average_fps", lambda: 45.5)

        resp = client.get("/api/v1/tasks")
        assert resp.status_code == 200
        body = resp.json()
        assert body["avg_fps"] == 45.5