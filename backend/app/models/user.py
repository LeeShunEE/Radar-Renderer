"""用户领域模型。

领域模型不依赖任何边界类型（schemas / ORM）。``User`` 表示对外公开身份，
凭据单独放在 ``UserCredentials``，仅认证流程使用。
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr


class User(BaseModel):
    """用户公开身份。"""

    model_config = ConfigDict(frozen=True)

    id: int
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    created_at: datetime


class UserCredentials(BaseModel):
    """认证所需的用户凭据（仅 auth 流程内部使用）。"""

    model_config = ConfigDict(frozen=True)

    user_id: int
    username: str
    password_hash_secret_string: SecretStr
