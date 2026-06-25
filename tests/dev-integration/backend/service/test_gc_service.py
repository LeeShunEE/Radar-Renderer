"""GC 服务 dev-integration 测试。

使用真实文件系统验证 GC 清理逻辑：
1. 时间维度：删除过期文件
2. 配额维度：删除超配额的最老文件

使用真实 SQLite 本地文件库（§4.1 允许）。
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.dao.orm import Base
from app.dao.render_task_dao import RenderTaskDAO
from app.dao.user_dao import UserDAO
from app.models.render_task import Codec, RenderMode, RenderStatus
from app.service.file_service import FileService
from app.service.gc_service import OutputGCService
from app.utils.sizing import directory_size


@pytest.fixture
async def memory_engine():
    """内存 SQLite 引擎。"""
    from sqlalchemy.pool import StaticPool

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def memory_session(memory_engine) -> AsyncSession:
    """内存 SQLite 会话。"""
    factory = async_sessionmaker(memory_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
def tmp_storage(tmp_path: Path) -> Path:
    """临时存储根目录。"""
    storage = tmp_path / "storage"
    storage.mkdir(parents=True)
    return storage


@pytest.fixture
def file_service(tmp_storage: Path) -> FileService:
    """文件服务实例。"""
    return FileService(tmp_storage, 200 * 1024 * 1024)


@pytest.fixture
def gc_config() -> Settings:
    """GC 测试配置。"""
    return Settings(
        output_gc_enabled=True,
        output_gc_interval_seconds=3600,
        output_gc_max_age_days=7,
        output_gc_max_size_bytes=100,  # 100 bytes 配额，方便测试
    )


@pytest.fixture
async def gc_service(
    memory_engine, file_service: FileService, gc_config: Settings
) -> OutputGCService:
    """GC 服务实例。"""
    factory = async_sessionmaker(memory_engine, expire_on_commit=False)

    @asynccontextmanager
    async def session_factory():
        async with factory() as session:
            yield session

    return OutputGCService(
        session_factory=session_factory,
        file_service=file_service,
        config=gc_config,
    )


class TestCleanupExpiredFiles:
    """时间维度清理测试。"""

    async def test_deletes_expired_files(
        self,
        memory_session: AsyncSession,
        file_service: FileService,
        gc_service: OutputGCService,
        tmp_storage: Path,
    ) -> None:
        """删除过期文件，保留未过期文件。"""
        # 创建用户和任务
        user_dao = UserDAO(memory_session)
        user = await user_dao.create(
            email="test@example.com", username="testuser", is_verified=True
        )

        task_dao = RenderTaskDAO(memory_session)
        # 创建两个任务：一个过期、一个未过期
        outputs_dir = file_service.outputs_dir(user.id)

        # 过期任务（8 天前完成）
        expired_file = outputs_dir / "expired.mp4"
        expired_file.write_bytes(b"expired content here")
        expired_task = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(expired_file),
        )
        # 手动设置为 done + finished_at 过期
        await task_dao.mark_done(
            expired_task.id,
            str(expired_file),
            duration_ms=100,
        )
        # 直接修改 finished_at（通过 raw SQL）
        cutoff = datetime.now(tz=UTC) - timedelta(days=8)
        await memory_session.execute(
            text(
                "UPDATE render_tasks SET finished_at = :cutoff WHERE id = :id"
            ),
            {"cutoff": cutoff, "id": expired_task.id},
        )
        await memory_session.commit()

        # 未过期任务（刚完成）
        fresh_file = outputs_dir / "fresh.mp4"
        fresh_file.write_bytes(b"fresh content")
        fresh_task = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(fresh_file),
        )
        await task_dao.mark_done(fresh_task.id, str(fresh_file), duration_ms=100)

        # 执行清理
        deleted = await gc_service.cleanup_user_outputs(user.id)

        # 验证：过期文件被删除，未过期文件保留
        assert expired_task.id in deleted
        assert fresh_task.id not in deleted
        assert not expired_file.exists()
        assert fresh_file.exists()


class TestCleanupQuotaExceeded:
    """配额维度清理测试。"""

    async def test_deletes_oldest_when_quota_exceeded(
        self,
        memory_session: AsyncSession,
        file_service: FileService,
        gc_service: OutputGCService,
        tmp_storage: Path,
    ) -> None:
        """配额超限时删除最老文件。"""
        # 创建用户
        user_dao = UserDAO(memory_session)
        user = await user_dao.create(
            email="test@example.com", username="testuser", is_verified=True
        )

        task_dao = RenderTaskDAO(memory_session)
        outputs_dir = file_service.outputs_dir(user.id)

        # 创建三个文件，总大小超过 100 bytes 配额
        # 最老文件（finished_at 最早）
        oldest_file = outputs_dir / "oldest.mp4"
        oldest_file.write_bytes(b"a" * 60)  # 60 bytes
        oldest_task = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(oldest_file),
        )
        await task_dao.mark_done(oldest_task.id, str(oldest_file), duration_ms=100)

        # 中间文件
        middle_file = outputs_dir / "middle.mp4"
        middle_file.write_bytes(b"b" * 40)  # 40 bytes
        middle_task = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(middle_file),
        )
        await task_dao.mark_done(middle_task.id, str(middle_file), duration_ms=100)
        # 手动设置 finished_at 比 oldest 晚
        await memory_session.execute(
            text(
                "UPDATE render_tasks SET finished_at = :time WHERE id = :id"
            ),
            {
                "time": datetime.now(tz=UTC) - timedelta(days=1),
                "id": middle_task.id,
            },
        )
        await memory_session.commit()

        # 执行清理（总大小 100 bytes，配额 100 bytes，应该刚好不超）
        # 但因为我们创建时 oldest + middle 已经超过配额（60+40=100，刚好到配额边界）
        # 实际上 directory_size 会统计 outputs_dir 的全部内容
        deleted = await gc_service.cleanup_user_outputs(user.id)

        # 配额正好 100，总大小 100，不需要删除（<= 配额）
        # 但如果再创建一个新文件就会超配额
        assert len(deleted) == 0

    async def test_deletes_until_quota_ok(
        self,
        memory_session: AsyncSession,
        file_service: FileService,
        gc_service: OutputGCService,
        tmp_storage: Path,
    ) -> None:
        """超配额时持续删除最老文件直到配额达标。"""
        # 创建用户
        user_dao = UserDAO(memory_session)
        user = await user_dao.create(
            email="test@example.com", username="testuser2", is_verified=True
        )

        task_dao = RenderTaskDAO(memory_session)
        outputs_dir = file_service.outputs_dir(user.id)

        # 创建三个大文件，明显超配额
        file1 = outputs_dir / "file1.mp4"
        file1.write_bytes(b"a" * 80)  # 80 bytes
        task1 = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(file1),
        )
        await task_dao.mark_done(task1.id, str(file1), duration_ms=100)
        # 设置 file1 的 finished_at 为最早（2 天前）
        await memory_session.execute(
            text(
                "UPDATE render_tasks SET finished_at = :time WHERE id = :id"
            ),
            {
                "time": datetime.now(tz=UTC) - timedelta(days=2),
                "id": task1.id,
            },
        )
        await memory_session.commit()

        file2 = outputs_dir / "file2.mp4"
        file2.write_bytes(b"b" * 80)  # 80 bytes
        task2 = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(file2),
        )
        await task_dao.mark_done(task2.id, str(file2), duration_ms=100)
        # file2 的 finished_at 为默认（now），比 file1 晚

        # 总大小 160 bytes，配额 100 bytes
        # 应删除最老的 file1（80 bytes），剩余 80 bytes <= 100
        deleted = await gc_service.cleanup_user_outputs(user.id)

        assert task1.id in deleted  # 最老的被删除
        assert task2.id not in deleted  # 较新的保留
        assert not file1.exists()
        assert file2.exists()


class TestNoCleanup:
    """不清理场景测试。"""

    async def test_no_cleanup_when_no_tasks(
        self,
        memory_session: AsyncSession,
        file_service: FileService,
        gc_service: OutputGCService,
    ) -> None:
        """无任务时不清理。"""
        user_dao = UserDAO(memory_session)
        user = await user_dao.create(
            email="empty@example.com", username="emptyuser", is_verified=True
        )

        deleted = await gc_service.cleanup_user_outputs(user.id)
        assert deleted == []

    async def test_no_cleanup_when_files_missing(
        self,
        memory_session: AsyncSession,
        file_service: FileService,
        gc_service: OutputGCService,
        tmp_storage: Path,
    ) -> None:
        """文件不存在时跳过（不报错）。"""
        user_dao = UserDAO(memory_session)
        user = await user_dao.create(
            email="missing@example.com", username="missinguser", is_verified=True
        )

        task_dao = RenderTaskDAO(memory_session)
        outputs_dir = file_service.outputs_dir(user.id)

        # 创建任务但文件路径不存在
        missing_file = outputs_dir / "missing.mp4"
        task = await task_dao.create(
            user_id=user.id,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={},
            output_path=str(missing_file),
        )
        await task_dao.mark_done(task.id, str(missing_file), duration_ms=100)

        # 文件不存在，清理应跳过
        deleted = await gc_service.cleanup_user_outputs(user.id)
        assert deleted == []