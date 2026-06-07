"""service/file_service.py 单元测试（文件 I/O 走临时目录，§4 允许）。"""

from pathlib import Path

import pytest

from app.core.exceptions import (
    InvalidFileError,
    QuotaExceededError,
    StoredFileNotFoundError,
)
from app.service.file_service import FileService

_UID = 1


def _service(tmp_path: Path, max_bytes: int = 1000) -> FileService:
    return FileService(tmp_path / "storage", max_bytes)


class TestSaveAndList:
    def test_save_then_list(self, tmp_path: Path):
        service = _service(tmp_path)
        service.save_upload(_UID, "a.png", b"12345")
        files = service.list_uploads(_UID)
        assert [f.name for f in files] == ["a.png"]
        assert files[0].size_bytes == 5

    def test_overwrite_does_not_double_count(self, tmp_path: Path):
        service = _service(tmp_path, max_bytes=10)
        service.save_upload(_UID, "a.bin", b"12345")
        # 覆盖同名文件：旧占用应被扣除，不触发配额
        service.save_upload(_UID, "a.bin", b"67890")
        assert service.usage(_UID).used_bytes == 5

    def test_user_isolation(self, tmp_path: Path):
        service = _service(tmp_path)
        service.save_upload(1, "a.png", b"x")
        assert service.list_uploads(2) == []


class TestQuota:
    def test_usage_reports_limit(self, tmp_path: Path):
        service = _service(tmp_path, max_bytes=1000)
        service.save_upload(_UID, "a.bin", b"x" * 100)
        usage = service.usage(_UID)
        assert usage.used_bytes == 100
        assert usage.limit_bytes == 1000
        assert usage.available_bytes == 900

    def test_exceed_quota_raises(self, tmp_path: Path):
        service = _service(tmp_path, max_bytes=10)
        with pytest.raises(QuotaExceededError):
            service.save_upload(_UID, "big.bin", b"x" * 11)

    def test_cumulative_quota(self, tmp_path: Path):
        service = _service(tmp_path, max_bytes=10)
        service.save_upload(_UID, "a.bin", b"x" * 6)
        with pytest.raises(QuotaExceededError):
            service.save_upload(_UID, "b.bin", b"x" * 6)


class TestValidationAndDelete:
    @pytest.mark.parametrize("bad", ["../escape", "a/b.png", "", ".."])
    def test_invalid_filename(self, tmp_path: Path, bad: str):
        service = _service(tmp_path)
        with pytest.raises(InvalidFileError):
            service.save_upload(_UID, bad, b"x")

    def test_delete_removes_file(self, tmp_path: Path):
        service = _service(tmp_path)
        service.save_upload(_UID, "a.png", b"x")
        service.delete_upload(_UID, "a.png")
        assert service.list_uploads(_UID) == []

    def test_delete_missing_raises(self, tmp_path: Path):
        service = _service(tmp_path)
        with pytest.raises(StoredFileNotFoundError):
            service.delete_upload(_UID, "ghost.png")
