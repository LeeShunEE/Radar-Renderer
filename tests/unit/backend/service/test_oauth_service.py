"""oauth_service 单元测试：provider 配置探测与授权 URL 生成（无进程外 I/O）。"""

import pytest

from app.core.config import settings
from app.core.exceptions import OAuthError
from app.service.oauth_service import OAuthService


class TestIsProviderConfigured:
    def test_google_configured_when_client_id_set(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "oauth_google_client_id", "g-id")
        assert OAuthService.is_provider_configured("google") is True

    def test_google_not_configured_when_client_id_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "oauth_google_client_id", None)
        assert OAuthService.is_provider_configured("google") is False

    def test_github_reflects_client_id(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "oauth_github_client_id", "gh-id")
        assert OAuthService.is_provider_configured("github") is True

    def test_unknown_provider_is_false(self):
        assert OAuthService.is_provider_configured("wechat") is False


class TestGetAuthorizationUrl:
    def test_unsupported_provider_raises(self):
        with pytest.raises(OAuthError):
            OAuthService.get_authorization_url("wechat")

    def test_google_unconfigured_raises(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setattr(settings, "oauth_google_client_id", None)
        with pytest.raises(OAuthError):
            OAuthService.get_authorization_url("google")

    def test_google_configured_returns_authorize_url(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(settings, "oauth_google_client_id", "g-id")
        monkeypatch.setattr(settings, "oauth_google_redirect_uri", "http://x/cb")

        url = OAuthService.get_authorization_url("google")
        assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
        assert "client_id=g-id" in url
