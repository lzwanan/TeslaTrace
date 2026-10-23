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

from .timeutil import day_start, month_start, to_naive_utc

_SQL_DIR = Path(__file__).with_name("sql")

FAR_FUTURE = datetime(2100, 1, 1)
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
        self, car_id: int, limit: int = 20, before: datetime | None = None
    ) -> list[dict[str, Any]]:
        return await self._all(
            "recent_drives",
            {
                "car_id": car_id,
                "limit": max(1, min(limit, 100)),
                # A far-future bound keeps one query shape for the first page too.
                "before": to_naive_utc(before) if before else FAR_FUTURE,
            },
        )

    async def last_position(self, car_id: int) -> dict[str, Any] | None:
        rows = await self._all("last_position", {"car_id": car_id})
        return rows[0] if rows else None

    async def healthy(self) -> bool:
        try:
            async with self._pool.connection() as conn:
                await conn.execute("SELECT 1")
            return True
        except Exception:  # noqa: BLE001 - health endpoint reports, never raises
            return False
