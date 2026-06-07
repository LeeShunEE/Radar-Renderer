"""渲染提交接口契约（接口层 Request/Response）。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.models.render_task import Codec, RenderMode, RenderStatus, RenderTask


class RenderSubmitRequest(BaseModel):
    mode: RenderMode = Field(description="渲染模式：single / multi")
    codec: Codec = Field(description="编码格式：h264 / gif")
    input_props: dict[str, Any] = Field(description="图表配置，结构由前端定义")


class RenderTaskResponse(BaseModel):
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

    @classmethod
    def from_domain(cls, task: RenderTask) -> "RenderTaskResponse":
        return cls(
            id=task.id,
            mode=task.mode,
            codec=task.codec,
            status=task.status,
            input_props=task.input_props,
            output_path=task.output_path,
            error=task.error,
            duration_ms=task.duration_ms,
            created_at=task.created_at,
            started_at=task.started_at,
            finished_at=task.finished_at,
        )
