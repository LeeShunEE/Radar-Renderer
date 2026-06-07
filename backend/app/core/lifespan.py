"""应用生命周期：启动队列消费协程 + 重载未完成任务，关闭时清理。"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.service.queue_service import render_queue


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """应用生命周期钩子。

    启动时：若 render_queue_autostart 为 True，启动消费协程并重载 DB 中未完成任务。
    关闭时：停止消费协程。
    """
    if settings.render_queue_autostart:
        await render_queue.reload_pending()
        await render_queue.start()
    yield
    if settings.render_queue_autostart:
        await render_queue.stop()
