"""Timezone regressions.

TeslaMate writes UTC into `timestamp without time zone` columns. If these
conversions are wrong the dashboard shows yesterday's drives as today's, or the
clock is off by the UTC offset — both are invisible in a happy-path test.
"""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.timeutil import as_utc, day_start, month_start, to_naive_utc

SHANGHAI = ZoneInfo("Asia/Shanghai")


def test_as_utc_marks_naive_values_as_utc():
    naive = datetime(2026, 10, 23, 9, 32, 54)
    assert as_utc(naive) == datetime(2026, 10, 23, 9, 32, 54, tzinfo=UTC)


def test_as_utc_converts_aware_values_instead_of_relabelling():
    aware = datetime(2026, 10, 23, 17, 32, 54, tzinfo=SHANGHAI)
    assert as_utc(aware) == datetime(2026, 10, 23, 9, 32, 54, tzinfo=UTC)


def test_day_start_returns_local_midnight_as_naive_utc():
    # 01:11 on the 24th in Shanghai is 17:11 UTC on the 23rd.
    now = datetime(2026, 10, 23, 17, 11, tzinfo=UTC)
    assert day_start(now, SHANGHAI) == datetime(2026, 10, 23, 16, 0)


def test_month_start_handles_the_offset():
    now = datetime(2026, 10, 31, 17, 0, tzinfo=UTC)  # 1 Nov 01:00 in Shanghai
    assert month_start(now, SHANGHAI) == datetime(2026, 10, 31, 16, 0)


def test_to_naive_utc_round_trip():
    local = datetime(2026, 10, 24, 1, 11, tzinfo=SHANGHAI)
    naive = to_naive_utc(local)
    assert naive == datetime(2026, 10, 23, 17, 11)
    assert naive.tzinfo is None
