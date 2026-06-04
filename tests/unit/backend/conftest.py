"""Unit 阶段特化 fixture。"""

import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def mock_session():
    """Unit 阶段基础 mock session。"""
    return AsyncMock()