"""用户存储文件领域模型（由文件系统构造）。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class StoredFile(BaseModel):
    """用户上传的一个文件。"""

    model_config = ConfigDict(frozen=True)

    name: str
    size_bytes: int
    modified_at: datetime


class StorageUsage(BaseModel):
    """用户存储用量与配额。"""

    model_config = ConfigDict(frozen=True)

    used_bytes: int
    limit_bytes: int
    upload_count: int = 0  # 当前上传文件数量
    upload_limit: int = 500  # 上传文件数量限制

    @computed_field  # type: ignore[prop-decorator]
    @property
    def available_bytes(self) -> int:
        return max(self.limit_bytes - self.used_bytes, 0)
