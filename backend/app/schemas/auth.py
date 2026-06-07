"""认证接口契约（接口层 Request/Response）。"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import User


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 OAuth2 token 类型字面量，非机密


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    @classmethod
    def from_domain(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id,
            username=user.username,
            email=user.email,
            created_at=user.created_at,
        )
