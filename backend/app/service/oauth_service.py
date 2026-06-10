"""OAuth 服务：Google/GitHub OAuth 流程处理。

支持：
- 发起 OAuth 授权（生成授权 URL）
- 处理 OAuth 回调（换取 access_token、获取用户信息、自动注册/登录）
"""

from authlib.integrations.base_client import OAuthError
from authlib.integrations.httpx_client import AsyncOAuth2Client
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import OAuthError as BusinessOAuthError, OAuthAccountAlreadyBoundError
from app.dao.oauth_dao import OAuthDAO
from app.dao.user_dao import UserDAO
from app.models.user import User


class OAuthService:
    """OAuth 流程处理。"""

    def __init__(self, session: AsyncSession) -> None:
        self._oauth_dao = OAuthDAO(session)
        self._user_dao = UserDAO(session)

    def get_authorization_url(self, provider: str) -> str:
        """生成 OAuth 授权 URL。

        Args:
            provider: "google" | "github"

        Returns:
            授权页面 URL

        Raises:
            OAuthError: provider 未配置或不支持
        """
        if provider == "google":
            return self._get_google_authorization_url()
        elif provider == "github":
            return self._get_github_authorization_url()
        else:
            raise BusinessOAuthError(f"不支持的 OAuth provider: {provider}")

    def _get_google_authorization_url(self) -> str:
        """生成 Google OAuth 授权 URL。"""
        if not settings.oauth_google_client_id:
            raise BusinessOAuthError("Google OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_google_client_id,
            client_secret=settings.oauth_google_client_secret_secret_string.get_secret_value() if settings.oauth_google_client_secret_secret_string else None,
            redirect_uri=settings.oauth_google_redirect_uri,
            scope="openid email profile",
        )
        url, _ = client.create_authorization_url(
            "https://accounts.google.com/o/oauth2/v2/auth",
            state="google",  # 用于 CSRF 防护
        )
        return url

    def _get_github_authorization_url(self) -> str:
        """生成 GitHub OAuth 授权 URL。"""
        if not settings.oauth_github_client_id:
            raise BusinessOAuthError("GitHub OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_github_client_id,
            client_secret=settings.oauth_github_client_secret_secret_string.get_secret_value() if settings.oauth_github_client_secret_secret_string else None,
            redirect_uri=settings.oauth_github_redirect_uri,
            scope="user:email",
        )
        url, _ = client.create_authorization_url(
            "https://github.com/login/oauth/authorize",
            state="github",
        )
        return url

    async def handle_callback(
        self,
        provider: str,
        code: str,
        state: str,
    ) -> tuple[User, bool]:
        """处理 OAuth 回调。

        Args:
            provider: "google" | "github"
            code: OAuth provider 返回的授权码
            state: OAuth state 参数（用于 CSRF 防护）

        Returns:
            (User, is_new_user) 元组
            - User: 登录/注册的用户
            - is_new_user: 是否首次登录（自动注册）

        Raises:
            OAuthError: OAuth 流程失败
            OAuthAccountAlreadyBoundError: OAuth 账户已被其他用户绑定
        """
        if provider == "google":
            return await self._handle_google_callback(code, state)
        elif provider == "github":
            return await self._handle_github_callback(code, state)
        else:
            raise BusinessOAuthError(f"不支持的 OAuth provider: {provider}")

    async def _handle_google_callback(
        self,
        code: str,
        state: str,
    ) -> tuple[User, bool]:
        """处理 Google OAuth 回调。"""
        if not settings.oauth_google_client_id:
            raise BusinessOAuthError("Google OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_google_client_id,
            client_secret=settings.oauth_google_client_secret_secret_string.get_secret_value() if settings.oauth_google_client_secret_secret_string else None,
            redirect_uri=settings.oauth_google_redirect_uri,
            scope="openid email profile",
        )

        # 换取 access_token
        try:
            token = await client.fetch_token(
                "https://oauth2.googleapis.com/token",
                code=code,
            )
        except OAuthError as e:
            raise BusinessOAuthError(f"Google OAuth token 交换失败: {e}") from e

        # 获取用户信息
        userinfo_resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
        userinfo = userinfo_resp.json()

        provider_user_id = userinfo.get("sub")
        provider_email = userinfo.get("email")
        provider_display_name = userinfo.get("name")

        if not provider_user_id or not provider_email:
            raise BusinessOAuthError("Google OAuth 返回的用户信息不完整")

        return await self._create_or_get_user(
            provider="google",
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_display_name=provider_display_name,
        )

    async def _handle_github_callback(
        self,
        code: str,
        state: str,
    ) -> tuple[User, bool]:
        """处理 GitHub OAuth 回调。"""
        if not settings.oauth_github_client_id:
            raise BusinessOAuthError("GitHub OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_github_client_id,
            client_secret=settings.oauth_github_client_secret_secret_string.get_secret_value() if settings.oauth_github_client_secret_secret_string else None,
            redirect_uri=settings.oauth_github_redirect_uri,
            scope="user:email",
        )

        # 换取 access_token
        try:
            token = await client.fetch_token(
                "https://github.com/login/oauth/access_token",
                code=code,
            )
        except OAuthError as e:
            raise BusinessOAuthError(f"GitHub OAuth token 交换失败: {e}") from e

        # 获取用户信息
        user_resp = await client.get("https://api.github.com/user")
        user_info = user_resp.json()

        provider_user_id = str(user_info.get("id"))
        provider_display_name = user_info.get("name") or user_info.get("login")

        # GitHub 可能不返回 email，需要额外请求
        provider_email = user_info.get("email")
        if not provider_email:
            # 尝试获取 emails
            emails_resp = await client.get("https://api.github.com/user/emails")
            emails = emails_resp.json()
            primary_email = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                None,
            )
            provider_email = primary_email.get("email") if primary_email else None

        if not provider_user_id:
            raise BusinessOAuthError("GitHub OAuth 返回的用户信息不完整")

        return await self._create_or_get_user(
            provider="github",
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_display_name=provider_display_name,
        )

    async def _create_or_get_user(
        self,
        provider: str,
        provider_user_id: str,
        provider_email: str | None,
        provider_display_name: str | None,
    ) -> tuple[User, bool]:
        """根据 OAuth 信息创建或获取用户。

        Args:
            provider: OAuth provider
            provider_user_id: provider 返回的用户 ID
            provider_email: provider 返回的邮箱
            provider_display_name: provider 返回的显示名

        Returns:
            (User, is_new_user) 元组
        """
        # 检查 OAuth 账户是否已绑定
        oauth_account = await self._oauth_dao.get_by_provider_user_id(
            provider, provider_user_id
        )

        if oauth_account is not None:
            # 已绑定，获取用户
            user = await self._user_dao.get_by_id(oauth_account.user_id)
            if user is None:
                raise BusinessOAuthError("OAuth 绑定的用户不存在")
            return user, False

        # 检查邮箱是否已注册
        existing_user = None
        if provider_email:
            existing_user = await self._user_dao.get_by_email(provider_email)

        if existing_user is not None:
            # 邮箱已注册，绑定 OAuth 账户
            await self._oauth_dao.create(
                user_id=existing_user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                provider_email=provider_email,
                provider_display_name=provider_display_name,
            )
            return existing_user, False

        # 首次登录，自动注册
        user = await self._user_dao.create(
            email=provider_email or f"{provider}_{provider_user_id}@placeholder.oauth",  # fallback email
            username=None,
            password_hash=None,
            is_verified=True,  # OAuth 用户邮箱已验证
            display_name=provider_display_name,
        )

        # 创建 OAuth 绑定
        await self._oauth_dao.create(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_display_name=provider_display_name,
        )

        return user, True

    async def bind_oauth_account(
        self,
        user_id: int,
        provider: str,
        code: str,
        state: str,
    ) -> User:
        """绑定 OAuth 账户（已登录用户）。

        Args:
            user_id: 当前用户 ID
            provider: OAuth provider
            code: OAuth 授权码
            state: OAuth state

        Returns:
            当前用户

        Raises:
            OAuthAccountAlreadyBoundError: OAuth 账户已被其他用户绑定
        """
        # 获取 OAuth 用户信息
        if provider == "google":
            provider_user_id, provider_email, provider_display_name = await self._get_google_userinfo(code)
        elif provider == "github":
            provider_user_id, provider_email, provider_display_name = await self._get_github_userinfo(code)
        else:
            raise BusinessOAuthError(f"不支持的 OAuth provider: {provider}")

        # 检查是否已绑定其他用户
        existing_binding = await self._oauth_dao.get_by_provider_user_id(
            provider, provider_user_id
        )
        if existing_binding is not None and existing_binding.user_id != user_id:
            raise OAuthAccountAlreadyBoundError(
                f"{provider} 账户已被其他用户绑定"
            )

        # 检查是否已绑定当前用户
        if existing_binding is not None and existing_binding.user_id == user_id:
            return await self._user_dao.get_by_id(user_id)  # 已绑定，直接返回

        # 创建绑定
        await self._oauth_dao.create(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            provider_display_name=provider_display_name,
        )

        return await self._user_dao.get_by_id(user_id)

    async def unbind_oauth_account(self, user_id: int, provider: str) -> bool:
        """解绑 OAuth 账户。

        Args:
            user_id: 当前用户 ID
            provider: OAuth provider

        Returns:
            是否成功解绑
        """
        return await self._oauth_dao.delete(user_id, provider)

    async def list_oauth_accounts(self, user_id: int) -> list:
        """获取用户已绑定的 OAuth 账户列表。"""
        return await self._oauth_dao.list_by_user(user_id)

    async def _get_google_userinfo(self, code: str) -> tuple[str, str | None, str | None]:
        """获取 Google 用户信息（用于绑定）。"""
        if not settings.oauth_google_client_id:
            raise BusinessOAuthError("Google OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_google_client_id,
            client_secret=settings.oauth_google_client_secret_secret_string.get_secret_value() if settings.oauth_google_client_secret_secret_string else None,
            redirect_uri=settings.oauth_google_redirect_uri,
            scope="openid email profile",
        )

        token = await client.fetch_token("https://oauth2.googleapis.com/token", code=code)
        userinfo_resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
        userinfo = userinfo_resp.json()

        return (
            userinfo.get("sub"),
            userinfo.get("email"),
            userinfo.get("name"),
        )

    async def _get_github_userinfo(self, code: str) -> tuple[str, str | None, str | None]:
        """获取 GitHub 用户信息（用于绑定）。"""
        if not settings.oauth_github_client_id:
            raise BusinessOAuthError("GitHub OAuth 未配置")

        client = AsyncOAuth2Client(
            client_id=settings.oauth_github_client_id,
            client_secret=settings.oauth_github_client_secret_secret_string.get_secret_value() if settings.oauth_github_client_secret_secret_string else None,
            redirect_uri=settings.oauth_github_redirect_uri,
            scope="user:email",
        )

        token = await client.fetch_token("https://github.com/login/oauth/access_token", code=code)
        user_resp = await client.get("https://api.github.com/user")
        user_info = user_resp.json()

        provider_user_id = str(user_info.get("id"))
        provider_display_name = user_info.get("name") or user_info.get("login")

        provider_email = user_info.get("email")
        if not provider_email:
            emails_resp = await client.get("https://api.github.com/user/emails")
            emails = emails_resp.json()
            primary_email = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                None,
            )
            provider_email = primary_email.get("email") if primary_email else None

        return provider_user_id, provider_email, provider_display_name