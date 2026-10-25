"""Read-only queries.

Every TeslaMate column name this project knows about lives in ``sql/``. That is
the whole anti-corruption layer: when TeslaMate ships a schema migration, the
fix is one file here, not a hunt through route handlers.

No DDL is issued, ever. TeslaTrace runs on a `SELECT`-only role, so setup needs
no database ownership and no migration step.
"""

from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from psycopg_pool import AsyncConnectionPool

from .timeutil import day_start, month_keys, month_start, months_back, to_naive_utc

_SQL_DIR = Path(__file__).with_name("sql")

FAR_FUTURE = datetime(2100, 1, 1)
FAR_PAST = datetime(1970, 1, 1)
EMPTY_STATS = {"today_drives": 0, "today_km": 0.0, "month_drives": 0, "month_km": 0.0}


@lru_cache(maxsize=32)
def query(name: str) -> str:
    return (_SQL_DIR / f"{name}.sql").read_text(encoding="utf-8")


class Store:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def _all(self, name: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        async with self._pool.connection() as conn, conn.cursor() as cur:
            await cur.execute(query(name), params)
            return await cur.fetchall()

    async def cars(self) -> list[dict[str, Any]]:
        return await self._all("cars", {})

    async def driving_stats(self, car_id: int, tz, now: datetime | None = None) -> dict[str, Any]:
        now = now or datetime.now(UTC)
        rows = await self._all(
            "driving_stats",
            {"car_id": car_id, "today": day_start(now, tz), "month": month_start(now, tz)},
        )
        return rows[0] if rows else dict(EMPTY_STATS)

    async def recent_drives(
        self,
        car_id: int,
        limit: int = 20,
        before: datetime | None = None,
        since: datetime | None = None,
    ) -> list[dict[str, Any]]:
        return await self._all(
            "recent_drives",
            {
                "car_id": car_id,
                "limit": max(1, min(limit, 100)),
                # Far-future and far-past bounds keep one query shape for every page.
                "before": to_naive_utc(before) if before else FAR_FUTURE,
                "since": to_naive_utc(since) if since else FAR_PAST,
            },
        )

    async def last_position(self, car_id: int) -> dict[str, Any] | None:
        rows = await self._all("last_position", {"car_id": car_id})
        return rows[0] if rows else None

    async def extras(self, car_id: int, tz) -> dict[str, Any]:
        """Yearly totals, charging habits, driving habits and frequent places.

        Four queries on small tables (drives 3.6k rows, charging 500 rows). The
        insights page composes these with `stats` so it still costs one round trip.
        """
        params = {"car_id": car_id, "tz": str(tz)}
        yearly, charging, habits, places = (
            await self._all("yearly", params),
            (await self._all("charging_profile", params))[0],
            (await self._all("habits", params))[0],
            await self._all("places", params),
        )
        return {
            "yearly": yearly,
            "charging": {
                "sessions": charging["sessions"] or 0,
                "avg_kw": charging["avg_kw"],
                "avg_minutes": charging["avg_minutes"],
                "max_kwh": charging["max_kwh"],
                # Distribution of what the pack was charged to, and when charging began.
                "levels": [
                    {"key": "full", "value": charging["full"]},
                    {"key": "to90", "value": charging["to90"]},
                    {"key": "to80", "value": charging["to80"]},
                    {"key": "below80", "value": charging["below80"]},
                ],
                "hours": [
                    {"key": "night", "value": charging["night"]},
                    {"key": "day", "value": charging["day"]},
                    {"key": "evening", "value": charging["evening"]},
                ],
            },
            "habits": {k: habits[k] for k in habits},
            "places": places,
        }

    async def climate_hours(self, car_id: int, since: datetime) -> float:
        rows = await self._all("climate_today", {"car_id": car_id, "since": to_naive_utc(since)})
        return round(rows[0]["hours"], 2) if rows else 0.0

    async def stats(self, car_id: int, tz, months: int = 6, now: datetime | None = None) -> dict[str, Any]:
        """Monthly distance and energy, plus a battery estimate from charge sessions."""
        now = now or datetime.now(UTC)
        params = {"car_id": car_id, "since": months_back(now, tz, months), "tz": str(tz)}
        drives, charges, battery = (
            await self._all("monthly_drives", params),
            await self._all("monthly_charges", params),
            (await self._all("battery", {"car_id": car_id}))[0],
        )

        by_month = {
            key: {"month": key, "km": 0.0, "drives": 0, "kwh": 0.0, "cost": None, "sessions": 0, "costed": 0}
            for key in month_keys(now, tz, months)
        }
        for row in drives:
            entry = by_month.get(row["month"])
            if entry is not None:
                entry["km"], entry["drives"] = row["km"], row["drives"]
        for row in charges:
            entry = by_month.get(row["month"])
            if entry is not None:
                entry["kwh"], entry["cost"] = row["kwh"], row["cost"]
                entry["sessions"], entry["costed"] = row["sessions"], row["costed"]

        series = []
        for entry in by_month.values():
            km, cost = entry["km"], entry["cost"]
            # Cost per kilometre, not Wh/km: this ratio divides *charged* energy by
            # distance, so charging losses and parked drain would inflate an energy
            # figure and make it impossible to compare with the car's own number.
            entry["cost_per_km"] = round(cost / km, 3) if km and cost else None
            series.append(entry)

        return {
            "months": series,
            "battery": {
                "capacity_kwh": battery.get("capacity_kwh"),
                "samples": battery.get("samples") or 0,
                "rated_range_km": battery.get("rated_range_km"),
            },
            "totals": {
                "km": round(sum(item["km"] for item in series), 1),
                "kwh": round(sum(item["kwh"] for item in series), 1),
                "cost": round(sum(item["cost"] or 0 for item in series), 2),
                "costed": sum(item["costed"] for item in series),
                "drives": sum(item["drives"] for item in series),
                "sessions": sum(item["sessions"] for item in series),
            },
        }

    async def healthy(self) -> bool:
        try:
            async with self._pool.connection() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:  # noqa: BLE001 - health endpoint reports, never raises
            return False
