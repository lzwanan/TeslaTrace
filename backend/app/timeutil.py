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
