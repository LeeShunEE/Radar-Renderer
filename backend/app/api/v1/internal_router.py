"""内部端点：供渲染 worker 旁路上报进度（非用户态，共享密钥鉴权）。

worker 在 Remotion ``onProgress`` 里把「已渲染帧/总帧」反向 POST 回此端点，
后端写入 RenderQueue 内存态（瞬时，与 position/eta 同生命周期），供 GET /tasks 暴露。
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import verify_render_callback_token
from app.schemas.task import RenderProgressRequest
from app.service.queue_service import render_queue

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post(
    "/render-progress/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_render_callback_token)],
)
async def report_render_progress(
    task_id: int,
    body: RenderProgressRequest,
) -> None:
    """记录 worker 上报的渲染进度（非运行中任务的上报会被队列忽略）。"""
    render_queue.update_progress(task_id, body.rendered_frames, body.total_frames)
