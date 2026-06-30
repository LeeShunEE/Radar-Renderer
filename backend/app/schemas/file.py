"""文件接口契约（接口层 Request/Response）。"""

from datetime import datetime

from pydantic import BaseModel

from app.models.stored_file import StorageUsage, StoredFile


class FileResponse(BaseModel):
    name: str
    size_bytes: int
    modified_at: datetime

    @classmethod
    def from_domain(cls, stored: StoredFile) -> "FileResponse":
        return cls(
            name=stored.name,
            size_bytes=stored.size_bytes,
            modified_at=stored.modified_at,
        )


class QuotaResponse(BaseModel):
    used_bytes: int
    limit_bytes: int
    available_bytes: int
    upload_count: int  # 当前上传文件数量
    upload_limit: int  # 上传文件数量限制

    @classmethod
    def from_domain(cls, usage: StorageUsage) -> "QuotaResponse":
        return cls(
            used_bytes=usage.used_bytes,
            limit_bytes=usage.limit_bytes,
            available_bytes=usage.available_bytes,
            upload_count=usage.upload_count,
            upload_limit=usage.upload_limit,
        )


class FileListResponse(BaseModel):
    files: list[FileResponse]
    quota: QuotaResponse


class UploadResponse(BaseModel):
    file: FileResponse
    quota: QuotaResponse


class AssetResponse(BaseModel):
    """公共资源条目（silhouettes / music）。"""

    name: str
    path: str
    size_bytes: int
