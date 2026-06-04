"""跨阶段通用 fixture。"""

import pytest
from unittest.mock import MagicMock


@pytest.fixture
def mock_task():
    """跨阶段通用 Task mock。"""
    return MagicMock(id="t001", title="Test Task")