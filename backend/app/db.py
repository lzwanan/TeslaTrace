"""Database pool lifecycle.

Two jobs only: create the pool, and wait for PostgreSQL to become reachable.
Compose starts containers in parallel, so TeslaTrace is almost always up before
the database accepts connections — retrying here is what makes `up -d` work on
the first try.
"""

from __future__ import annotations

import asyncio
import logging

from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from .config import Settings

log = logging.getLogger(__name__)


async def open_pool(settings: Settings, attempts: int = 30, delay: float = 2.0) -> AsyncConnectionPool:
    pool = AsyncConnectionPool(
        conninfo=settings.dsn,
        min_size=1,
        max_size=6,
        open=False,
        kwargs={
            "row_factory": dict_row,
            "application_name": "teslatrace",
            # A slow query must never pin the event loop: the database kills it
            # first and the route returns 503 instead of stalling every SSE stream.
            "options": "-c statement_timeout=5000",
        },
    )
    await pool.open(wait=False)

    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            async with pool.connection(timeout=5) as conn:
                await conn.execute("SELECT 1")
            log.info("database connected (%s:%s/%s)", settings.database_host, settings.database_port, settings.database_name)
            return pool
        except Exception as exc:  # noqa: BLE001 - report and keep waiting
            last_error = exc
            if attempt == 1 or attempt % 5 == 0:
                log.warning("database not ready (attempt %s/%s): %s", attempt, attempts, exc)
            await asyncio.sleep(delay)

    await pool.close()
    raise RuntimeError(f"database unreachable after {attempts} attempts: {last_error}")
