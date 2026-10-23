"""Timezone regressions.

TeslaMate writes UTC into `timestamp without time zone` columns. If these
conversions are wrong the dashboard shows yesterday's drives as today's, or the
clock is off by the UTC offset — both are invisible in a happy-path test.
"""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.timeutil import as_utc, day_start, month_keys, month_start, months_back, to_naive_utc

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


def test_month_keys_lists_every_month_oldest_first():
    now = datetime(2026, 10, 24, 1, 53, tzinfo=UTC)
    assert month_keys(now, SHANGHAI, 4) == ["2026-07", "2026-08", "2026-09", "2026-10"]


def test_month_keys_crosses_the_year_boundary():
    now = datetime(2026, 2, 1, 0, 0, tzinfo=SHANGHAI)
    assert month_keys(now, SHANGHAI, 3) == ["2025-12", "2026-01", "2026-02"]


def test_months_back_returns_local_month_start_as_naive_utc():
    now = datetime(2026, 10, 24, 1, 53, tzinfo=UTC)  # 09:53 in Shanghai
    # 6 months back from October is May, local midnight == 30 Apr 16:00 UTC
    assert months_back(now, SHANGHAI, 6) == datetime(2026, 4, 30, 16, 0)


def test_months_back_across_new_year():
    now = datetime(2026, 1, 15, 12, 0, tzinfo=SHANGHAI)
    assert months_back(now, SHANGHAI, 3) == datetime(2025, 10, 31, 16, 0)
