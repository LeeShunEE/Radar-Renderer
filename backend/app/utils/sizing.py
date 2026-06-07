"""体积统计辅助。"""

from pathlib import Path

_UNITS = ("B", "KiB", "MiB", "GiB", "TiB")


def directory_size(path: Path) -> int:
    """递归统计目录下所有文件的总字节数；目录不存在时返回 0。"""
    if not path.exists():
        return 0
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def human_readable(num_bytes: int) -> str:
    """把字节数格式化为人类可读字符串（如 ``1.5 MiB``）。"""
    size = float(num_bytes)
    for unit in _UNITS:
        if size < 1024 or unit == _UNITS[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} {_UNITS[-1]}"
