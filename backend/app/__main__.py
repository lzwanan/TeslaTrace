"""``python -m app`` — the documented way to run the service.

This module exists for one reason. On Windows asyncio defaults to
ProactorEventLoop, which psycopg's async driver refuses to use, and uvicorn
imports the application *inside* the running loop — so setting the policy from
``app.main`` is already too late. Here it happens before uvicorn builds a loop.
Linux (the container) is unaffected.
"""

from __future__ import annotations

import asyncio
import sys

if sys.platform == "win32":  # pragma: no cover - platform specific
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

if __name__ == "__main__":  # pragma: no cover - process entrypoint
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="info")
