"""service/render_service.py 单元测试（DAO + 队列全 mock）。"""

from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.render_task import Codec, RenderMode, RenderStatus, RenderTask
from app.service.render_service import RenderService


def _make_task(**overrides) -> RenderTask:
    defaults = {
        "id": 42,
        "user_id": 1,
        "mode": RenderMode.SINGLE,
        "codec": Codec.H264,
        "status": RenderStatus.QUEUED,
        "input_props": {"chart": "radar"},
        "output_path": "/tmp/out.mp4",
    }
    defaults["created_at"] = datetime(2026, 1, 1, tzinfo=UTC)
    defaults.update(overrides)
    return RenderTask(**defaults)


def _make_service(dao: AsyncMock, queue: MagicMock) -> RenderService:
    service = RenderService.__new__(RenderService)
    service._dao = dao
    service._queue = queue
    service._files = MagicMock()
    service._files.outputs_dir.return_value = Path("/tmp/outputs/1")
    return service


class TestSubmit:
    async def test_submit_creates_and_enqueues(self):
        dao = AsyncMock()
        dao.create.return_value = _make_task()
        queue = MagicMock()
        service = _make_service(dao, queue)

        task = await service.submit(
            user_id=1,
            mode=RenderMode.SINGLE,
            codec=Codec.H264,
            input_props={"chart": "radar"},
        )

        assert task.id == 42
        assert task.status is RenderStatus.QUEUED
        dao.create.assert_awaited_once()
        queue.enqueue.assert_called_once_with(42)
