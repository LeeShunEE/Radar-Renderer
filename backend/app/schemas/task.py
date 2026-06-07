"""任务查询接口契约（接口层 Response）。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.render_task import Codec, RenderMode, RenderStatus
from app.service.task_service import TaskView


class TaskResponse(BaseModel):
    """单个任务 + 队列派生信息。"""

    id: int
    mode: RenderMode
    codec: Codec
    status: RenderStatus
    input_props: dict[str, Any]
    output_path: str
    error: str | None = None
    duration_ms: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    position: int
    eta_seconds: float | None

    @classmethod
    def from_domain(cls, view: TaskView) -> "TaskResponse":
        t = view.task
        return cls(
            id=t.id,
            mode=t.mode,
            codec=t.codec,
            status=t.status,
            input_props=t.input_props,
            output_path=t.output_path,
            error=t.error,
            duration_ms=t.duration_ms,
            created_at=t.created_at,
            started_at=t.started_at,
            finished_at=t.finished_at,
            position=view.position,
            eta_seconds=view.eta_seconds,
        )


class TaskListResponse(BaseModel):
    """任务列表 + 全局队列大小。"""

    queue_size: int
    tasks: list[TaskResponse]
