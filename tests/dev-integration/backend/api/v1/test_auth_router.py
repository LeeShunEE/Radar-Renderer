"""auth_router dev-integration：注册→登录→me→refresh 全链路（真实 SQLite）。"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings

# 用户名密码注册契约（仅 /register-with-password 与登录链路使用）。
_REG = {
    "username": "alice",
    "email": "alice@example.com",
    "password": "password123",
}


class TestRegister:
    def test_register_returns_token(self, register_user: Callable[..., dict]):
        # 邮箱验证码注册成功后自动登录，直接返回 token。
        tokens = register_user()
        assert tokens["token_type"] == "bearer"
        assert tokens["access_token"]
        assert tokens["refresh_token"]

    def test_duplicate_email_conflicts(
        self,
        client: TestClient,
        captured_codes: list[str],
        monkeypatch: pytest.MonkeyPatch,
    ):
        # 关闭冷却以便对同一邮箱连发两次验证码。
        monkeypatch.setattr(settings, "verification_code_cooldown_seconds", 0)
        email = "dup@example.com"

        def _send_and_register():
            client.post(
                "/api/v1/auth/send-code",
                json={"email": email, "purpose": "register"},
            )
            code = captured_codes[-1]
            return client.post(
                "/api/v1/auth/register", json={"email": email, "code": code}
            )

        assert _send_and_register().status_code == 201
        resp = _send_and_register()
        assert resp.status_code == 409
        assert resp.json()["code"] == "user_exists"


class TestLoginAndMe:
    def test_login_then_me(self, client: TestClient):
        # 登录需密码，使用 register-with-password 建一个带用户名/密码的用户。
        client.post("/api/v1/auth/register-with-password", json=_REG)
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
        client.post("/api/v1/auth/register-with-password", json=_REG)
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


class TestOAuthStateCsrf:
    def test_start_returns_auth_url_with_state(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "oauth_google_client_id", "g-id")
        monkeypatch.setattr(
            settings, "oauth_google_redirect_uri", "http://localhost:13000/cb"
        )
        resp = client.get("/api/v1/auth/oauth/google/start")
        assert resp.status_code == 200
        assert "state=" in resp.json()["auth_url"]

    def test_callback_with_unknown_state_rejected(self, client: TestClient):
        # 未经 start 落库的 state → CSRF 校验失败，在换 token 前即拒绝
        resp = client.get(
            "/api/v1/auth/oauth/google/callback",
            params={"code": "x", "state": "forged-state"},
        )
        assert resp.status_code == 400
        assert resp.json()["code"] == "oauth_error"


class TestRefresh:
    def test_refresh_issues_new_access(
        self, client: TestClient, register_user: Callable[..., dict]
    ):
        tokens = register_user()
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_refresh_with_access_token_rejected(
        self, client: TestClient, register_user: Callable[..., dict]
    ):
        tokens = register_user()
        resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens["access_token"]},
        )
        assert resp.status_code == 401
