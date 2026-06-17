"""auth_router dev-integration：注册→登录→me→refresh 全链路（真实 SQLite）。"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

_REG = {
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123",
}


class TestRegister:
    def test_register_returns_user(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", json=_REG)
        assert resp.status_code == 201
        body = resp.json()
        assert body["username"] == "alice"
        assert "password" not in body

    def test_duplicate_register_conflicts(self, client: TestClient):
        client.post("/api/v1/auth/register", json=_REG)
        resp = client.post("/api/v1/auth/register", json=_REG)
        assert resp.status_code == 409
        assert resp.json()["code"] == "user_exists"


class TestLoginAndMe:
    def test_login_then_me(self, client: TestClient):
        client.post("/api/v1/auth/register", json=_REG)
        login = client.post(
            "/api/v1/auth/login",
            json={"username": "alice", "password": "password123"},
        )
        assert login.status_code == 200
        tokens = login.json()
        assert tokens["token_type"] == "bearer"

        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["username"] == "alice"

    def test_login_wrong_password(self, client: TestClient):
        client.post("/api/v1/auth/register", json=_REG)
        resp = client.post(
            "/api/v1/auth/login",
            json={"username": "alice", "password": "nope"},
        )
        assert resp.status_code == 401

    def test_me_without_token_unauthorized(self, client: TestClient):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401


class TestOAuthProviders:
    def test_providers_all_disabled_by_default(self, client: TestClient):
        resp = client.get("/api/v1/auth/oauth/providers")
        assert resp.status_code == 200
        assert resp.json() == {"google": False, "github": False}

    def test_providers_reflect_configured_client_ids(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "oauth_google_client_id", "g-client-id")
        monkeypatch.setattr(settings, "oauth_github_client_id", None)

        resp = client.get("/api/v1/auth/oauth/providers")
        assert resp.status_code == 200
        assert resp.json() == {"google": True, "github": False}


class TestRefresh:
    def test_refresh_issues_new_access(self, client: TestClient):
        client.post("/api/v1/auth/register", json=_REG)
        tokens = client.post(
            "/api/v1/auth/login",
            json={"username": "alice", "password": "password123"},
        ).json()

        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_with_access_token_rejected(self, client: TestClient):
        client.post("/api/v1/auth/register", json=_REG)
        tokens = client.post(
            "/api/v1/auth/login",
            json={"username": "alice", "password": "password123"},
        ).json()

        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["access_token"]},
        )
        assert resp.status_code == 401
