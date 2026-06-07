"""service/queue_service.py 单元测试。

队列内存态逻辑（入队/取消/排位/ETA）不依赖 DB 或网络，
直接构造 RenderQueue 实例验证。
"""

import asyncio
from unittest.mock import AsyncMock

import pytest

from app.service.queue_service import RenderQueue


def _make_queue(concurrency: int = 2) -> RenderQueue:
    worker = AsyncMock()
    session_factory = AsyncMock()
    return RenderQueue(
        concurrency=concurrency,
        worker=worker,
        session_factory=session_factory,
    )


class TestEnqueueAndCancel:
    def test_enqueue_increases_pending(self):
        q = _make_queue()
        q.enqueue(10)
        assert 10 in q._pending
        assert q.queue_size() == 1

    def test_cancel_removes_from_pending(self):
        q = _make_queue()
        q.enqueue(10)
        q.cancel(10)
        assert 10 not in q._pending
        assert 10 in q._canceled

    def test_forget_removes_everywhere(self):
        q = _make_queue()
        q.enqueue(10)
        q._running[20] = 0.0
        q.forget(10)
        q.forget(20)
        assert 10 not in q._pending
        assert 20 not in q._running
        assert q.queue_size() == 0

    def test_reset_clears_all(self):
        q = _make_queue()
        q.enqueue(1)
        q.enqueue(2)
        q._running[3] = 0.0
        q._canceled.add(4)
        q.reset()
        assert q.queue_size() == 0
        assert len(q._canceled) == 0


class TestPosition:
    def test_position_in_pending(self):
        q = _make_queue()
        q.enqueue(10)
        q.enqueue(20)
        q.enqueue(30)
        assert q.position(10) == 1
        assert q.position(20) == 2
        assert q.position(30) == 3

    def test_position_running_returns_zero(self):
        q = _make_queue()
        q._running[10] = 0.0
        assert q.position(10) == 0

    def test_position_unknown_returns_zero(self):
        q = _make_queue()
        assert q.position(999) == 0


class TestEta:
    def test_eta_for_running_task(self):
        q = _make_queue()
        # 无历史样本时使用默认 60s
        q._running[10] = 0.0  # monotonic 起始设为极早 → elapsed 很大
        # 因为 elapsed > avg(60s)，结果应被 clamp 到 0
        import time
        q._running[10] = time.monotonic() - 100
        eta = q.eta_seconds(10)
        assert eta is not None
        assert eta >= 0.0

    def test_eta_for_pending_task(self):
        q = _make_queue()
        q.enqueue(10)
        eta = q.eta_seconds(10)
        assert eta is not None
        assert eta > 0

    def test_eta_for_unknown_returns_none(self):
        q = _make_queue()
        assert q.eta_seconds(999) is None


class TestAverageDuration:
    def test_default_when_no_samples(self):
        q = _make_queue()
        assert q.average_duration() == 60.0

    def test_with_samples(self):
        q = _make_queue()
        q._durations.extend([10.0, 20.0, 30.0])
        assert q.average_duration() == 20.0
