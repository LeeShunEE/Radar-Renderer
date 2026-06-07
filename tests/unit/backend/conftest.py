"""Unit 阶段特化 fixture。"""

from unittest.mock import AsyncMock

import pytest


@pytest.fixture
def mock_session():
    """Unit 阶段基础 mock session。"""
    return AsyncMock()