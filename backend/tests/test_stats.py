"""The stats endpoint is a merge, and merges are where quiet bugs live."""

from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.store import Store

SHANGHAI = ZoneInfo("Asia/Shanghai")
NOW = datetime(2026, 10, 24, 1, 0, tzinfo=UTC)


def build(monkeypatch, drives, charges, battery=None):
    store = Store(pool=None)  # nothing touches the pool: `_all` is replaced

    async def fake_all(name, params):
        if name == "monthly_drives":
            return drives
        if name == "monthly_charges":
            return charges
        return [battery or {"capacity_kwh": 56.0, "samples": 12, "rated_range_km": 412.0}]

    monkeypatch.setattr(store, "_all", fake_all)
    return store


async def test_months_with_no_data_are_filled_in(monkeypatch):
    store = build(
        monkeypatch,
        drives=[
            {"month": "2026-09", "drives": 83, "km": 944.8},
            {"month": "2026-10", "drives": 67, "km": 680.0},
        ],
        charges=[
            {"month": "2026-09", "sessions": 12, "kwh": 180.0, "cost": 60.0, "costed": 10},
            {"month": "2026-10", "sessions": 6, "kwh": 90.0, "cost": None, "costed": 0},
        ],
    )

    result = await store.stats(1, SHANGHAI, months=3, now=NOW)

    assert [m["month"] for m in result["months"]] == ["2026-08", "2026-09", "2026-10"]
    august = result["months"][0]
    assert august["km"] == 0.0
    assert august["drives"] == 0
    assert august["cost_per_km"] is None  # no distance, no ratio
    assert result["months"][1]["cost_per_km"] == 0.064  # 60 of 944.8 km


async def test_totals_ignore_months_outside_the_window(monkeypatch):
    store = build(
        monkeypatch,
        drives=[
            {"month": "2026-01", "drives": 5, "km": 100.0},  # older than the window
            {"month": "2026-10", "drives": 67, "km": 680.0},
        ],
        charges=[{"month": "2026-10", "sessions": 6, "kwh": 90.0, "cost": 30.0, "costed": 6}],
    )

    result = await store.stats(1, SHANGHAI, months=3, now=NOW)

    assert result["totals"]["km"] == 680.0
    assert result["totals"]["drives"] == 67
    assert result["totals"]["kwh"] == 90.0
    assert result["totals"]["cost"] == 30.0
    assert result["totals"]["sessions"] == 6


async def test_missing_cost_is_not_reported_as_zero_spend(monkeypatch):
    store = build(
        monkeypatch,
        drives=[{"month": "2026-10", "drives": 10, "km": 100.0}],
        charges=[{"month": "2026-10", "sessions": 4, "kwh": 40.0, "cost": None, "costed": 0}],
    )

    result = await store.stats(1, SHANGHAI, months=3, now=NOW)

    month = result["months"][-1]
    assert month["cost"] is None
    assert month["costed"] == 0
    assert result["totals"]["costed"] == 0


async def test_battery_is_passed_through(monkeypatch):
    store = build(monkeypatch, drives=[], charges=[])

    result = await store.stats(1, SHANGHAI, months=3, now=NOW)

    assert result["battery"] == {"capacity_kwh": 56.0, "samples": 12, "rated_range_km": 412.0}
    assert result["totals"]["km"] == 0.0


async def test_extras_assembles_the_four_blocks(monkeypatch):
    store = Store(pool=None)

    async def fake_all(name, params):
        if name == "yearly":
            return [{"year": 2026, "drives": 1027, "km": 13242.0, "avg_km": 12.9,
                     "longest_km": 218.8, "sessions": 155, "kwh": 3559.0, "cost": 1344.0, "costed": 142}]
        if name == "charging_profile":
            return [{"sessions": 470, "avg_kw": 22.2, "avg_minutes": 176, "max_kwh": 55.2,
                     "full": 373, "to90": 39, "to80": 14, "below80": 44,
                     "night": 93, "day": 110, "evening": 267}]
        if name == "habits":
            return [{"drives": 3589, "avg_kmh": 46.0, "avg_minutes": 22, "avg_km": 16.8,
                     "longest_km": 358.3, "days_used": 848, "night_drives": 371,
                     "short_drives": 1498, "busiest_day_km": 1322.1}]
        return [{"name": "湖城风华", "visits": 407}]

    monkeypatch.setattr(store, "_all", fake_all)
    data = await store.extras(1, SHANGHAI)

    assert data["yearly"][0]["year"] == 2026
    # Distributions keep a stable key order so the UI can render labels from them.
    assert [item["key"] for item in data["charging"]["levels"]] == ["full", "to90", "to80", "below80"]
    assert [item["key"] for item in data["charging"]["hours"]] == ["night", "day", "evening"]
    assert data["charging"]["levels"][0]["value"] == 373
    assert data["habits"]["short_drives"] == 1498
    assert data["places"][0] == {"name": "湖城风华", "visits": 407}
