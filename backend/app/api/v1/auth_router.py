"""认证路由：验证码发送、注册、登录、刷新、当前用户、OAuth。"""

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, SessionDep
from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.schemas.auth import (
    LoginRequest,
    OAuthAccountResponse,
    OAuthStartResponse,
    RefreshRequest,
    RegisterRequest,
    RegisterWithPasswordRequest,
    SendCodeRequest,
    SetPasswordRequest,
    SetUsernameRequest,
    TokenResponse,
    UserResponse,
)
from app.service.auth_service import AuthService
from app.service.email_service import EmailService
from app.service.oauth_service import OAuthService
from app.service.verification_service import VerificationService
from app.service.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user_id: int, is_new_user: bool = False) -> TokenResponse:
    subject = str(user_id)
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
        is_new_user=is_new_user,
    )


@router.post("/send-code", status_code=status.HTTP_200_OK)
async def send_verification_code(
    payload: SendCodeRequest,
    session: SessionDep,
) -> dict[str, str]:
    """发送邮箱验证码。"""
    # 生成验证码
    verification_service = VerificationService(session)
    code = await verification_service.generate_code(payload.email, payload.purpose)

    # 发送邮件
    email_service = EmailService()
    await email_service.send_verification_code(payload.email, code, payload.purpose)

    return {"message": "验证码已发送"}


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterRequest, session: SessionDep) -> TokenResponse:
    """验证码验证后注册并自动登录。"""
    auth_service = AuthService(session)
    user = await auth_service.verify_and_register(
        email=payload.email,
        code=payload.code,
    )
    return _issue_tokens(user.id)


@router.post(
    "/register-with-password",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
)
async def register_with_password(
    payload: RegisterWithPasswordRequest,
    session: SessionDep,
) -> UserResponse:
    """用户名密码注册（已废弃，保留用于兼容）。"""
    user = await AuthService(session).register_with_password(
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    return UserResponse.from_domain(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: SessionDep) -> TokenResponse:
    """登录（支持用户名或邮箱）。"""
    auth_service = AuthService(session)
    user = await auth_service.authenticate(
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    return _issue_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, session: SessionDep) -> TokenResponse:
    token_payload = decode_token(
        payload.refresh_token, expected_type=TokenType.REFRESH
    )
    user = await UserService(session).get_by_id(int(token_payload["sub"]))
    return _issue_tokens(user.id)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUserDep) -> UserResponse:
    return UserResponse.from_domain(current_user)


@router.post("/set-username", response_model=UserResponse)
async def set_username(
    payload: SetUsernameRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """设置用户名（OAuth 用户首次登录后设置）。"""
    auth_service = AuthService(session)
    user = await auth_service.set_username(current_user.id, payload.username)
    return UserResponse.from_domain(user)


@router.post("/set-password", response_model=UserResponse)
async def set_password(
    payload: SetPasswordRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """设置密码（OAuth 用户后续设置密码）。"""
    auth_service = AuthService(session)
    user = await auth_service.set_password(current_user.id, payload.password)
    return UserResponse.from_domain(user)


# === OAuth 端点 ===


@router.get("/oauth/{provider}/start", response_model=OAuthStartResponse)
async def oauth_start(provider: str) -> OAuthStartResponse:
    """发起 OAuth 流程，返回授权 URL。

    Args:
        provider: "google" | "github"

    Returns:
        OAuth 授权页面 URL，前端应跳转到此 URL
    """
    # 注意：OAuthService 不需要 session 来生成 URL
    from app.service.oauth_service import OAuthService as OAuthServiceClass
    oauth_service = OAuthServiceClass.__new__(OAuthServiceClass)
    oauth_service._oauth_dao = None
    oauth_service._user_dao = None
    auth_url = oauth_service.get_authorization_url(provider)
    return OAuthStartResponse(auth_url=auth_url)


@router.get("/oauth/{provider}/callback", response_model=TokenResponse)
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    session: SessionDep,
) -> TokenResponse:
    """处理 OAuth 回调。

    Args:
        provider: "google" | "github"
        code: OAuth provider 返回的授权码
        state: OAuth state 参数（用于 CSRF 防护）

    Returns:
        JWT tokens + is_new_user 标志
    """
    oauth_service = OAuthService(session)
    user, is_new_user = await oauth_service.handle_callback(provider, code, state)
    return _issue_tokens(user.id, is_new_user)


@router.get("/oauth/accounts", response_model=list[OAuthAccountResponse])
async def list_oauth_accounts(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> list[OAuthAccountResponse]:
    """获取当前用户已绑定的 OAuth 账户列表。"""
    oauth_service = OAuthService(session)
    accounts = await oauth_service.list_oauth_accounts(current_user.id)
    return [
        OAuthAccountResponse(
            id=acc.id,
            provider=acc.provider,
            provider_email=acc.provider_email,
            provider_display_name=acc.provider_display_name,
            created_at=acc.created_at,
        )
        for acc in accounts
    ]


@router.post("/oauth/{provider}/bind", response_model=UserResponse)
async def bind_oauth_account(
    provider: str,
    code: str,
    state: str,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """绑定新的 OAuth 账户（已登录用户）。"""
    oauth_service = OAuthService(session)
    user = await oauth_service.bind_oauth_account(
        current_user.id, provider, code, state
    )
    return UserResponse.from_domain(user)


@router.delete("/oauth/{provider}/unbind", response_model=dict[str, bool])
async def unbind_oauth_account(
    provider: str,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> dict[str, bool]:
    """解绑 OAuth 账户。"""
    oauth_service = OAuthService(session)
    success = await oauth_service.unbind_oauth_account(current_user.id, provider)
    return {"success": success}
