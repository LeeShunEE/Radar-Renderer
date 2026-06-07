"""公共资源路由：列举与下载 silhouettes / music 等静态素材。无需认证。"""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse as FastAPIFileResponse

from app.core.config import settings
from app.schemas.file import AssetResponse

router = APIRouter(prefix="/assets", tags=["assets"])

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
_AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"}


def _list_assets(category_dir: Path, category: str, exts: set[str]) -> list[AssetResponse]:
    """列举目录下匹配扩展名的文件。"""
    if not category_dir.is_dir():
        return []
    return sorted(
        [
            AssetResponse(
                name=f.name,
                path=f"{category}/{f.name}",
                size_bytes=f.stat().st_size,
            )
            for f in category_dir.iterdir()
            if f.is_file() and f.suffix.lower() in exts
        ],
        key=lambda a: a.name,
    )


@router.get("/silhouettes", response_model=list[AssetResponse])
async def list_silhouettes() -> list[AssetResponse]:
    """列举公共剪影图片。"""
    return _list_assets(settings.public_assets_path / "silhouettes", "silhouettes", _IMAGE_EXTS)


@router.get("/music", response_model=list[AssetResponse])
async def list_music() -> list[AssetResponse]:
    """列举公共背景音乐。"""
    return _list_assets(settings.public_assets_path / "music", "music", _AUDIO_EXTS)


@router.get("/{category}/{name}")
async def get_asset(category: str, name: str) -> FastAPIFileResponse:
    """下载指定公共资源文件。"""
    # 安全校验：文件名不得含路径分隔符
    if "/" in name or "\\" in name or name in {".", ".."}:
        from app.core.exceptions import StoredFileNotFoundError
        raise StoredFileNotFoundError(f"非法文件名: {name}")
    if category not in {"silhouettes", "music"}:
        from app.core.exceptions import StoredFileNotFoundError
        raise StoredFileNotFoundError(f"未知资源分类: {category}")
    path = settings.public_assets_path / category / name
    if not path.is_file():
        from app.core.exceptions import StoredFileNotFoundError
        raise StoredFileNotFoundError(f"资源不存在: {category}/{name}")
    return FastAPIFileResponse(path, filename=name)
