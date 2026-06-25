"""渲染产物自动清理服务。

清理策略（双维度）：
1. 时间维度：删除 finished_at + gc_max_age_days < now 的产物
2. 配额维度：若目录大小超 gc_max_size_bytes，按 finished_at 删除最老文件

优雅停止：cancel + await（遵循 queue_service 模式）
"""

import asyncio
import logging
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.dao.render_task_dao import RenderTaskDAO
from app.dao.user_dao import UserDAO
from app.service.file_service import FileService
from app.utils.sizing import directory_size

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], AsyncSession]


class OutputGCService:
    """渲染产物自动清理服务。"""

    def __init__(
        self,
        session_factory: SessionFactory,
        file_service: FileService,
        config: Settings,
    ) -> None:
        self._session_factory = session_factory
        self._file_service = file_service
        self._config = config
        self._gc_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """启动周期性 GC 后台任务。"""
        if self._gc_task is not None:
            return
        self._gc_task = asyncio.create_task(self._gc_loop())
        logger.info(
            f"GC 服务已启动：周期 {self._config.output_gc_interval_seconds}s，"
            f"保留 {self._config.output_gc_max_age_days} 天，"
            f"单用户配额 {self._config.output_gc_max_size_bytes // 1024 // 1024}MB"
        )

    async def stop(self) -> None:
        """优雅停止 GC 任务。"""
        if self._gc_task is None:
            return
        self._gc_task.cancel()
        try:
            await self._gc_task
        except asyncio.CancelledError:
            pass
        self._gc_task = None
        logger.info("GC 服务已停止")

    async def _gc_loop(self) -> None:
        """主循环：await asyncio.sleep(interval) + run_gc_cycle()"""
        while True:
            await asyncio.sleep(self._config.output_gc_interval_seconds)
            try:
                await self.run_gc_cycle()
            except Exception:  # noqa: BLE001 后台循环不能因单次异常退出
                logger.exception("GC 周期执行异常")

    async def run_gc_cycle(self) -> None:
        """遍历所有用户，执行清理。"""
        async with self._session_factory() as session:
            user_dao = UserDAO(session)
            user_ids = await user_dao.list_all_ids()
        logger.debug(f"GC 周期开始：共 {len(user_ids)} 用户")

        total_deleted = 0
        for user_id in user_ids:
            deleted = await self.cleanup_user_outputs(user_id)
            total_deleted += len(deleted)

        logger.info(f"GC 周期完成：共删除 {total_deleted} 个产物文件")

    async def cleanup_user_outputs(self, user_id: int) -> list[int]:
        """清理指定用户的产物目录，返回删除的任务 ID 列表。

        清理顺序：
        1. 先按时间维度删除过期文件（finished_at + max_age_days < now）
        2. 再按配额维度删除最老文件（若 outputs 目录大小超过配额）

        文件删除后 DB 记录保留（Task 记录不动，只删产物文件）。
        """
        deleted_ids: list[int] = []

        async with self._session_factory() as session:
            dao = RenderTaskDAO(session)

            # 1. 时间维度：删除过期文件
            expired = await dao.list_expired_for_user(
                user_id, self._config.output_gc_max_age_days
            )
            for task in expired:
                output_path = Path(task.output_path)
                if output_path.is_file():
                    output_path.unlink()
                    logger.debug(f"GC 删除过期产物：task_id={task.id}")
                    deleted_ids.append(task.id)

            # 2. 配额维度：若 outputs 目录超配额，删除最老文件
            outputs_dir = self._file_service.outputs_dir(user_id)
            current_size = directory_size(outputs_dir)
            max_size = self._config.output_gc_max_size_bytes

            if current_size > max_size:
                # 获取所有 done 任务（按 finished_at 升序，已删除的文件仍返回）
                done_tasks = await dao.list_done_for_user(user_id)
                # 过滤掉已删除的任务，只处理文件仍存在的
                remaining = [t for t in done_tasks if Path(t.output_path).is_file()]
                # 按 finished_at 升序删除最老文件，直到配额达标
                for task in remaining:
                    output_path = Path(task.output_path)
                    if not output_path.is_file():
                        continue
                    file_size = output_path.stat().st_size
                    output_path.unlink()
                    current_size -= file_size
                    deleted_ids.append(task.id)
                    logger.debug(f"GC 删除超配额产物：task_id={task.id}")
                    if current_size <= max_size:
                        break

        return deleted_ids


# 单例初始化（在 lifespan 中启动）
from app.core.config import settings
from app.core.database import async_session_factory

output_gc = OutputGCService(
    session_factory=async_session_factory,
    file_service=FileService(settings.storage_root, settings.max_user_storage_bytes),
    config=settings,
)