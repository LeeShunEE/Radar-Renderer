"""文件路由：列举、上传、下载、删除用户素材与渲染产物。"""

from fastapi import APIRouter, UploadFile, status
from fastapi.responses import FileResponse as FastAPIFileResponse

from app.api.deps import CurrentUserDep, SessionDep
from app.core.config import settings
from app.core.exceptions import TaskNotFoundError
from app.dao.render_task_dao import RenderTaskDAO
from app.models.render_task import RenderStatus
from app.schemas.file import (
    FileListResponse,
    FileResponse,
    QuotaResponse,
    UploadResponse,
)
from app.service.file_service import FileService

router = APIRouter(prefix="/files", tags=["files"])


def _service() -> FileService:
    return FileService(
        settings.storage_root,
        settings.max_user_storage_bytes,
        settings.max_user_upload_count,
    )


@router.get("", response_model=FileListResponse)
async def list_files(current_user: CurrentUserDep) -> FileListResponse:
    service = _service()
    files = service.list_uploads(current_user.id)
    usage = service.usage(current_user.id)
    return FileListResponse(
        files=[FileResponse.from_domain(f) for f in files],
        quota=QuotaResponse.from_domain(usage),
    )


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    current_user: CurrentUserDep, file: UploadFile
) -> UploadResponse:
    service = _service()
    data = await file.read()
    stored = service.save_upload(current_user.id, file.filename or "", data)
    usage = service.usage(current_user.id)
    return UploadResponse(
        file=FileResponse.from_domain(stored),
        quota=QuotaResponse.from_domain(usage),
    )


@router.get("/uploads/{name}")
async def download_upload(current_user: CurrentUserDep, name: str) -> FastAPIFileResponse:
    """下载用户上传的素材文件。"""
    path = _service().get_upload_path(current_user.id, name)
    return FastAPIFileResponse(path, filename=name)


@router.get("/outputs/{task_id}")
async def download_output(
    task_id: int, current_user: CurrentUserDep, session: SessionDep
) -> FastAPIFileResponse:
    """下载已完成的渲染产物。"""
    dao = RenderTaskDAO(session)
    task = await dao.get_for_user(task_id, current_user.id)
    if task is None:
        raise TaskNotFoundError(f"任务不存在: id={task_id}")
    if task.status is not RenderStatus.DONE:
        raise TaskNotFoundError(f"任务尚未完成: id={task_id}")
    path = _service().get_output_path(current_user.id, task.output_path)
    filename = path.name
    return FastAPIFileResponse(path, filename=filename)


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(current_user: CurrentUserDep, name: str) -> None:
    _service().delete_upload(current_user.id, name)
