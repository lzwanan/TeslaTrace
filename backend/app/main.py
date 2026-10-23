"""Application factory."""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import ORJSONResponse

from . import __version__
from .api import health_router, router
from .config import Settings
from .db import open_pool
from .events import Hub
from .live import LiveRegistry
from .mqtt import MqttFeed
from .store import Store

log = logging.getLogger("teslatrace")


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    # Uvicorn would log every request twice otherwise; we log our own single line.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    # The pool retries in the background and logs each attempt; db.py reports the
    # underlying reason once per few seconds, which is enough.
    logging.getLogger("psycopg.pool").setLevel(logging.ERROR)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configure_logging(settings.log_level)
        log.info("TeslaTrace %s starting", __version__)

        if not settings.auth_token:
            log.warning("AUTH_TOKEN is empty — the API is open. Only do this on a trusted network.")
        log.info(
            "db=%s:%s/%s mqtt=%s:%s tz=%s",
            settings.database_host, settings.database_port, settings.database_name,
            settings.mqtt_host, settings.mqtt_port, settings.tz,
        )

        pool = await open_pool(settings)
        app.state.store = Store(pool)
        app.state.live = LiveRegistry()
        app.state.hub = Hub()
        app.state.mqtt = MqttFeed(settings, app.state.live, app.state.hub)
        app.state.settings = settings
        app.state.pool = pool

        feed_task = asyncio.create_task(app.state.mqtt.run(), name="mqtt")
        log.info("ready on :8000")

        try:
            yield
        finally:
            feed_task.cancel()
            try:
                await feed_task
            except asyncio.CancelledError:
                pass
            await pool.close()
            log.info("stopped")

    app = FastAPI(
        title="TeslaTrace",
        version=__version__,
        default_response_class=ORJSONResponse,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        if request.url.path != "/healthz":
            log.info(
                "%s %s %s %.0fms",
                request.method, request.url.path, response.status_code,
                (time.perf_counter() - started) * 1000,
            )
        return response

    @app.get("/")
    async def index():
        return {
            "name": "TeslaTrace",
            "version": __version__,
            "docs": "/api/docs",
            "summary": "/api/v1/summary",
            "health": "/healthz",
        }

    app.include_router(health_router())
    app.include_router(router(), prefix="/api/v1")
    return app


app = create_app()
