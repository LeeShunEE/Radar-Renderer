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


# OAuth 端点将在 Phase 2 实现
# @router.get("/oauth/{provider}/start", response_model=OAuthStartResponse)
# @router.get("/oauth/{provider}/callback", response_model=TokenResponse)
