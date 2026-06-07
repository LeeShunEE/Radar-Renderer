"""files_router dev-integration：上传→列举→删除（真实文件系统 + 认证）。"""

from fastapi.testclient import TestClient


class TestUploadList:
    def test_requires_auth(self, client: TestClient):
        assert client.get("/api/v1/files").status_code == 401

    def test_upload_then_list(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        up = client.post(
            "/api/v1/files",
            headers=auth_headers,
            files={"file": ("chart.png", b"binarydata", "image/png")},
        )
        assert up.status_code == 201
        body = up.json()
        assert body["file"]["name"] == "chart.png"
        assert body["quota"]["used_bytes"] == len(b"binarydata")

        listing = client.get("/api/v1/files", headers=auth_headers).json()
        assert [f["name"] for f in listing["files"]] == ["chart.png"]

    def test_users_are_isolated(self, client: TestClient, auth_headers: dict[str, str]):
        client.post(
            "/api/v1/files",
            headers=auth_headers,
            files={"file": ("a.png", b"x", "image/png")},
        )
        # 第二个用户看不到第一个用户的文件
        client.post(
            "/api/v1/auth/register",
            json={"username": "bob", "email": "bob@example.com", "password": "password123"},
        )
        bob = client.post(
            "/api/v1/auth/login",
            json={"username": "bob", "password": "password123"},
        ).json()
        bob_headers = {"Authorization": f"Bearer {bob['access_token']}"}
        listing = client.get("/api/v1/files", headers=bob_headers).json()
        assert listing["files"] == []


class TestDelete:
    def test_delete_file(self, client: TestClient, auth_headers: dict[str, str]):
        client.post(
            "/api/v1/files",
            headers=auth_headers,
            files={"file": ("a.png", b"x", "image/png")},
        )
        resp = client.delete("/api/v1/files/a.png", headers=auth_headers)
        assert resp.status_code == 204
        listing = client.get("/api/v1/files", headers=auth_headers).json()
        assert listing["files"] == []

    def test_delete_missing_404(self, client: TestClient, auth_headers: dict[str, str]):
        resp = client.delete("/api/v1/files/ghost.png", headers=auth_headers)
        assert resp.status_code == 404
        assert resp.json()["code"] == "file_not_found"
