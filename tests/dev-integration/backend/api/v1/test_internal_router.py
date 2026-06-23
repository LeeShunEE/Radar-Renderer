"""internal_router dev-integration：进度回调写入后 GET /tasks 反映帧数。

进程内链路（TestClient + 真实 SQLite + 进程内单例队列），符合 §4 网络边界。
"""

from fastapi.testclient import TestClient

from app.core.config import settings
from app.service.queue_service import render_queue

_TOKEN_HEADER = {
    "X-Render-Callback-Token": (
        settings.render_callback_token_secret_string.get_secret_value()
    )
}


def _submit(client: TestClient, headers: dict[str, str]) -> dict:
    resp = client.post(
        "/api/v1/render",
        headers=headers,
        json={"mode": "single", "codec": "h264", "input_props": {}},
    )
    assert resp.status_code == 201
    return resp.json()


class TestProgressRoundTrip:
    def test_progress_reflected_in_get_task(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        task = _submit(client, auth_headers)
        task_id = task["id"]
        # 模拟任务进入运行态（autostart 关闭，消费协程不跑）
        render_queue._running[task_id] = 0.0

        resp = client.post(
            f"/api/v1/internal/render-progress/{task_id}",
            headers=_TOKEN_HEADER,
            json={"rendered_frames": 45, "total_frames": 150},
        )
        assert resp.status_code == 204

        got = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
        assert got["rendered_frames"] == 45
        assert got["total_frames"] == 150

    def test_progress_ignored_when_not_running(
        self, client: TestClient, auth_headers: dict[str, str]
    ) -> None:
        task = _submit(client, auth_headers)
        task_id = task["id"]
        # 不放入 _running：上报被忽略，GET 仍为 None
        resp = client.post(
            f"/api/v1/internal/render-progress/{task_id}",
            headers=_TOKEN_HEADER,
            json={"rendered_frames": 45, "total_frames": 150},
        )
        assert resp.status_code == 204

        got = client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers).json()
        assert got["rendered_frames"] is None
        assert got["total_frames"] is None
