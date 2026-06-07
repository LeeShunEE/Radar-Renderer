"""utils/sizing.py 单元测试。"""

from pathlib import Path

from app.utils.sizing import directory_size, human_readable


class TestDirectorySize:
    def test_missing_dir_is_zero(self, tmp_path: Path):
        assert directory_size(tmp_path / "nope") == 0

    def test_sums_nested_files(self, tmp_path: Path):
        (tmp_path / "a.txt").write_bytes(b"x" * 10)
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / "b.txt").write_bytes(b"y" * 5)
        assert directory_size(tmp_path) == 15


class TestHumanReadable:
    def test_bytes(self):
        assert human_readable(512) == "512.0 B"

    def test_kib(self):
        assert human_readable(1536) == "1.5 KiB"

    def test_mib(self):
        assert human_readable(2 * 1024 * 1024) == "2.0 MiB"
