"""任务查询接口契约（接口层 Response）。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

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
    # 渲染中逐帧进度（worker 旁路回调提供）；非运行中或未上报时为 None。
    rendered_frames: int | None = None
    total_frames: int | None = None
    # 全局队列规模（排队 + 运行中），排队态展示「共 N 个」。
    queue_size: int = 0

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
            rendered_frames=view.rendered_frames,
            total_frames=view.total_frames,
            queue_size=view.queue_size,
        )


class TaskListResponse(BaseModel):
    """任务列表 + 全局队列大小 + 近期平均渲速。"""

    queue_size: int
    tasks: list[TaskResponse]
    # 近期平均渲速（帧/秒），进程级滚动均值；服务启动初期无样本时为 None。
    avg_fps: float | None = None


class RenderProgressRequest(BaseModel):
    """worker 旁路上报的渲染进度（内部端点入参）。"""

    rendered_frames: int = Field(ge=0, description="已渲染帧数")
    total_frames: int = Field(ge=0, description="合成总帧数")
