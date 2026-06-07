"""认证路由：注册、登录、刷新、当前用户。"""

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
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.service.auth_service import AuthService
from app.service.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user_id: int) -> TokenResponse:
    subject = str(user_id)
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterRequest, session: SessionDep) -> UserResponse:
    user = await AuthService(session).register(
        username=payload.username,
        email=payload.email,
        password=payload.password,
    )
    return UserResponse.from_domain(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: SessionDep) -> TokenResponse:
    user = await AuthService(session).authenticate(
        username=payload.username,
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
