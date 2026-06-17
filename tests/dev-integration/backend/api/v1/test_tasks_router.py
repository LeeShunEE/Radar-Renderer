"""tasks_router dev-integration：任务列表、详情、删除（mock worker，队列隔离）。"""

from collections.abc import Callable

from fastapi.testclient import TestClient


def _submit(client: TestClient, headers: dict[str, str]) -> dict:
    """提交一个渲染任务，返回 JSON body。"""
    resp = client.post(
        "/api/v1/render",
        headers=headers,
        json={"mode": "single", "codec": "h264", "input_props": {}},
    )
    assert resp.status_code == 201
    return resp.json()


class TestListTasks:
    def test_requires_auth(self, client: TestClient):
        assert client.get("/api/v1/tasks").status_code == 401

    def test_empty_list(self, client: TestClient, auth_headers: dict[str, str]):
        resp = client.get("/api/v1/tasks", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["tasks"] == []
        assert body["queue_size"] == 0

    def test_lists_submitted_tasks(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        task = _submit(client, auth_headers)
        resp = client.get("/api/v1/tasks", headers=auth_headers)
        body = resp.json()
        assert body["queue_size"] >= 1
        assert len(body["tasks"]) == 1
        assert body["tasks"][0]["id"] == task["id"]


class TestGetTask:
    def test_get_existing_task(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        task = _submit(client, auth_headers)
        resp = client.get(f"/api/v1/tasks/{task['id']}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == task["id"]

    def test_get_other_users_task_404(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        register_user: Callable[..., dict],
    ):
        task = _submit(client, auth_headers)
        # 注册第二个用户
        bob = register_user(email="bob@example.com")
        bob_headers = {"Authorization": f"Bearer {bob['access_token']}"}
        resp = client.get(f"/api/v1/tasks/{task['id']}", headers=bob_headers)
        assert resp.status_code == 404


class TestDeleteTask:
    def test_delete_existing(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        task = _submit(client, auth_headers)
        resp = client.delete(
            f"/api/v1/tasks/{task['id']}", headers=auth_headers
        )
        assert resp.status_code == 204
        # 确认列表为空
        listing = client.get("/api/v1/tasks", headers=auth_headers).json()
        assert listing["tasks"] == []

    def test_delete_missing_404(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        resp = client.delete("/api/v1/tasks/99999", headers=auth_headers)
        assert resp.status_code == 404
