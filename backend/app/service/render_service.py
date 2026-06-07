"""渲染提交服务：构造任务 → 落库 → 入队。"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dao.render_task_dao import RenderTaskDAO
from app.models.render_task import Codec, RenderMode, RenderTask
from app.service.file_service import FileService
from app.service.queue_service import RenderQueue


class RenderService:
    """提交服务端渲染任务。"""

    def __init__(self, session: AsyncSession, queue: RenderQueue) -> None:
        self._dao = RenderTaskDAO(session)
        self._queue = queue
        self._files = FileService(
            settings.storage_root, settings.max_user_storage_bytes
        )

    async def submit(
        self,
        *,
        user_id: int,
        mode: RenderMode,
        codec: Codec,
        input_props: dict,
    ) -> RenderTask:
        """创建一个排队中的渲染任务并入队，返回任务领域模型。"""
        ext = "gif" if codec is Codec.GIF else "mp4"
        output_path = self._files.outputs_dir(user_id) / f"{uuid.uuid4().hex}.{ext}"
        task = await self._dao.create(
            user_id=user_id,
            mode=mode,
            codec=codec,
            input_props=input_props,
            output_path=str(output_path),
        )
        self._queue.enqueue(task.id)
        return task
