"""internal_router 单元测试：进度回调端点的共享密钥鉴权（TestClient + mock）。

不走用户态 JWT；校验 X-Render-Callback-Token 与配置密钥。update_progress 被 patch，
断言合法 token → 204 且转调队列，错误/缺失 token → 401。
"""

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

_TOKEN = "dev-only-render-callback-token"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(settings, "render_queue_autostart", False)
    from app.service.queue_service import render_queue

    render_queue.reset()
    with TestClient(app) as test_client:
        yield test_client


class TestReportRenderProgress:
    """POST /internal/render-progress/{task_id} 鉴权与转调。"""

    def test_valid_token_returns_204_and_calls_queue(
        self, client: TestClient
    ) -> None:
        with pytest.MonkeyPatch.context() as mp:
            mock_queue = MagicMock()
            mp.setattr("app.api.v1.internal_router.render_queue", mock_queue)
            resp = client.post(
                "/api/v1/internal/render-progress/42",
                headers={"X-Render-Callback-Token": _TOKEN},
                json={"rendered_frames": 30, "total_frames": 120},
            )
        assert resp.status_code == 204
        mock_queue.update_progress.assert_called_once_with(42, 30, 120)

    def test_wrong_token_returns_401(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/internal/render-progress/42",
            headers={"X-Render-Callback-Token": "wrong"},
            json={"rendered_frames": 30, "total_frames": 120},
        )
        assert resp.status_code == 401

    def test_missing_token_returns_401(self, client: TestClient) -> None:
        resp = client.post(
            "/api/v1/internal/render-progress/42",
            json={"rendered_frames": 30, "total_frames": 120},
        )
        assert resp.status_code == 401
