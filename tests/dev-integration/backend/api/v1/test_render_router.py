"""render_router dev-integration：提交渲染任务（mock worker，队列隔离）。"""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


class TestSubmitRender:
    def test_requires_auth(self, client: TestClient):
        resp = client.post(
            "/api/v1/render",
            json={"mode": "single", "codec": "h264", "input_props": {}},
        )
        assert resp.status_code == 401

    def test_submit_returns_task(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        resp = client.post(
            "/api/v1/render",
            headers=auth_headers,
            json={"mode": "single", "codec": "h264", "input_props": {"chart": "radar"}},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["status"] == "queued"
        assert body["mode"] == "single"
        assert body["codec"] == "h264"
        assert body["input_props"] == {"chart": "radar"}
        assert "id" in body
        assert "output_path" in body

    def test_submit_gif_codec(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        resp = client.post(
            "/api/v1/render",
            headers=auth_headers,
            json={"mode": "multi", "codec": "gif", "input_props": {}},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["codec"] == "gif"
        assert body["output_path"].endswith(".gif")
