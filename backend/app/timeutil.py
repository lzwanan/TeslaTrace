"""Time handling.

TeslaMate stores every timestamp as ``timestamp without time zone`` holding UTC.
Two conversions matter, and getting either wrong silently shifts the dashboard by
the UTC offset:

* reading: attach UTC before serializing, otherwise the browser parses the naive
  string as local time;
* filtering: turn a local day boundary into a naive UTC value that can be
  compared against the column directly.
"""

from __future__ import annotations

from datetime import UTC, datetime, tzinfo


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def to_naive_utc(value: datetime) -> datetime:
    return as_utc(value).replace(tzinfo=None)


def day_start(now: datetime, tz: tzinfo) -> datetime:
    """Midnight today in the user's zone, expressed as naive UTC."""
    local = now.astimezone(tz)
    return to_naive_utc(local.replace(hour=0, minute=0, second=0, microsecond=0))


def month_start(now: datetime, tz: tzinfo) -> datetime:
    local = now.astimezone(tz)
    return to_naive_utc(local.replace(day=1, hour=0, minute=0, second=0, microsecond=0))


def months_back(now: datetime, tz: tzinfo, months: int) -> datetime:
    """First instant of the month N-1 months ago, as naive UTC."""
    local = now.astimezone(tz).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    index = local.month - months  # 0-based month arithmetic without dateutil
    year, month = local.year + index // 12, index % 12 + 1
    return to_naive_utc(local.replace(year=year, month=month))


def month_keys(now: datetime, tz: tzinfo, months: int) -> list[str]:
    """["2026-05", ...] oldest first, including months with no data."""
    local = now.astimezone(tz)
    keys = []
    for back in range(months - 1, -1, -1):
        index = local.month - 1 - back
        keys.append(f"{local.year + index // 12}-{index % 12 + 1:02d}")
    return keys
