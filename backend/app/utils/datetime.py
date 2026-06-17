"""时间工具：UTC aware 归一化。

数据库列虽声明为 ``DateTime(timezone=True)``，但 SQLite（aiosqlite）读出的是
naive datetime，而业务侧一律用 ``datetime.now(tz=UTC)``（aware）比较。直接比较会抛
``can't compare offset-naive and offset-aware``。读出后统一用本工具归一为 UTC aware。
"""

from datetime import UTC, datetime


def ensure_utc(value: datetime) -> datetime:
    """把可能为 naive 的 datetime 归一为 UTC aware。

    约定：库内存储的时间均为 UTC，故对 naive 值直接补挂 UTC tzinfo；
    对已带时区的值转换到 UTC。

    Args:
        value: 待归一的 datetime

    Returns:
        UTC aware datetime
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
