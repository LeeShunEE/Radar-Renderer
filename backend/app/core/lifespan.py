"""应用生命周期：启动队列消费协程 + 重载未完成任务，GC 服务，关闭时清理。"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.service.gc_service import output_gc
from app.service.queue_service import render_queue


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期钩子。

    启动时：
    1. 若 render_queue_autostart 为 True，启动消费协程并重载 DB 中未完成任务。
    2. 若 output_gc_enabled 为 True，启动 GC 服务。

    关闭时：反向顺序停止（GC → 队列）。
    """
    # 启动顺序：队列 → GC
    if settings.render_queue_autostart:
        await render_queue.reload_pending()
        await render_queue.start()
    if settings.output_gc_enabled:
        await output_gc.start()

    yield

    # 关闭顺序（反向）：GC → 队列
    if settings.output_gc_enabled:
        await output_gc.stop()
    if settings.render_queue_autostart:
        await render_queue.stop()
