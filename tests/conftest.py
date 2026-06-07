"""跨阶段通用数据 fixture（见 CLAUDE.md §6.1）。"""

from datetime import UTC, datetime

import pytest

from app.models.user import User


@pytest.fixture
def mock_user() -> User:
    """一个领域层 User 示例。"""
    return User(
        id=1,
        username="alice",
        email="alice@example.com",
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
