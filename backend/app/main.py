"""Application factory."""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import ORJSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .accounts import Accounts
from .api import health_router, router, session_router
from .config import Settings
from .db import open_pool
from .events import Hub
from .live import LiveRegistry
from .mqtt import MqttFeed
from .store import Store

log = logging.getLogger("teslatrace")

# Built by `npm run build` in frontend/ and copied here by the Dockerfile. Absent when
# running the backend alone, which is the normal case for development.
WEB_DIR = Path(__file__).with_name("static")

# `script-src 'self'` is why the theme is read from /theme-boot.js instead of an
# inline <script>: one extra 400-byte request buys a policy with no 'unsafe-inline'.
# connect-src 'self' lets the EventSource through; img-src data: covers the favicon.
CSP = (
    "default-src 'self'; "
    "img-src 'self' data:; "
    "style-src 'self' 'unsafe-inline'; "
    "script-src 'self'; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'self'"
)

# Swagger UI pulls its bundle from a CDN and inlines a boot script; it is the one
# page a strict policy cannot cover.
CSP_EXEMPT = ("/api/docs", "/api/openapi.json")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
}


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

        accounts = Accounts(settings.auth_file)
        app.state.accounts = accounts
        account = accounts.current()
        if account is None:
            log.warning(
                "no login configured — anyone who can reach this page sees where the car is. "
                "Turn one on in Settings."
            )
        else:
            log.info("login required as %r (%s)", account.username, settings.auth_file)
            if account.default_password:
                log.warning("the default password is still in use — change it in Settings")

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

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if not request.url.path.startswith(CSP_EXEMPT):
            response.headers.setdefault("Content-Security-Policy", CSP)
        return response

    app.include_router(health_router())
    app.include_router(session_router(), prefix="/api/v1")
    app.include_router(router(), prefix="/api/v1")

    if WEB_DIR.is_dir():
        # Mounted last so /api/* and /healthz win. Hash routing means the SPA only
        # ever needs "/" — no rewrite rule, no server-side routing.
        app.mount("/", StaticFiles(directory=WEB_DIR, html=True), name="web")
        log.info("serving web UI from %s", WEB_DIR)
    else:
        log.warning("no web build found (%s); API only", WEB_DIR)

        @app.get("/")
        async def index():
            return {
                "name": "TeslaTrace",
                "version": __version__,
                "docs": "/api/docs",
                "summary": "/api/v1/summary",
                "health": "/healthz",
                "web": "not built — run `npm run build` in frontend/",
            }

    return app


app = create_app()
