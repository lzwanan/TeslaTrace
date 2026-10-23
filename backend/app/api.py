"""HTTP surface.

Five routes, no more. Everything the home screen needs comes from
``/api/v1/summary`` in one round trip, because on a phone five parallel requests
feel worse than one slightly slower one.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime
from typing import Any

import orjson
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import ORJSONResponse
from sse_starlette.sse import EventSourceResponse

from .events import Hub
from .live import LiveRegistry
from .store import Store
from .timeutil import as_utc

log = logging.getLogger(__name__)


def _settings(request: Request):
    return request.app.state.settings


def _store(request: Request) -> Store:
    return request.app.state.store


def _live(request: Request) -> LiveRegistry:
    return request.app.state.live


def _hub(request: Request) -> Hub:
    return request.app.state.hub


async def require_token(
    request: Request,
    token: str | None = Query(default=None, description="Only needed for SSE: EventSource cannot set headers."),
) -> None:
    expected = _settings(request).auth_token
    if not expected:
        return
    supplied = token or ""
    header = request.headers.get("authorization", "")
    if not supplied and header.lower().startswith("bearer "):
        supplied = header[7:]
    if not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="invalid or missing token")


def _tz(settings):
    from zoneinfo import ZoneInfo

    return ZoneInfo(settings.tz)


def _car_label(car: dict[str, Any]) -> str:
    """Prefer the nickname the owner set in TeslaMate; fall back to model + trim."""
    if car.get("name"):
        return str(car["name"])
    model = car.get("model")
    descriptor = car.get("marketing_name") or car.get("trim_badging")
    base = f"Model {model}" if model else "Tesla"
    return f"{base} {descriptor}" if descriptor else base


async def _pick_car(request: Request, car_id: int | None) -> dict[str, Any]:
    cars = await _store(request).cars()
    if not cars:
        raise HTTPException(status_code=404, detail="no car found in this TeslaMate database")
    if car_id is None:
        return cars[0]
    for car in cars:
        if car["id"] == car_id:
            return car
    raise HTTPException(status_code=404, detail=f"car {car_id} not found")


async def _live_payload(request: Request, car_id: int) -> dict[str, Any]:
    """MQTT first; fall back to the newest row in `positions` so a cold start is not blank."""
    snapshot = _live(request).snapshot(car_id)
    if snapshot.get("updated_at"):
        snapshot["source"] = "mqtt"
        return snapshot

    position = await _store(request).last_position(car_id)
    if position is None:
        return {}
    return {
        "car_id": car_id,
        "source": "db",
        "battery_level": position.get("battery_level"),
        "est_battery_range_km": position.get("est_battery_range_km"),
        "odometer": position.get("odometer"),
        "latitude": position.get("latitude"),
        "longitude": position.get("longitude"),
        "speed": position.get("speed"),
        "power": position.get("power"),
        "updated_at": as_utc(position["date"]).timestamp(),
    }


def router() -> APIRouter:
    api = APIRouter(dependencies=[Depends(require_token)])

    @api.get("/cars")
    async def cars(request: Request):
        rows = await _store(request).cars()
        return [
            {**row, "label": _car_label(row), "vin_suffix": (row.get("vin") or "")[-5:]}
            for row in rows
        ]

    @api.get("/live")
    async def live(request: Request, car_id: int | None = None):
        car = await _pick_car(request, car_id)
        return await _live_payload(request, car["id"])

    @api.get("/summary")
    async def summary(request: Request, car_id: int | None = None):
        store = _store(request)
        car = await _pick_car(request, car_id)

        live_row = await _live_payload(request, car["id"])
        driving = await store.driving_stats(car["id"], _tz(_settings(request)))
        drives = await store.recent_drives(car["id"], limit=3)

        return {
            "car": {**car, "label": _car_label(car), "vin_suffix": (car.get("vin") or "")[-5:]},
            "live": live_row,
            "driving": driving,
            "recent_drives": [_drive_row(d) for d in drives],
        }

    @api.get("/drives")
    async def drives(
        request: Request,
        car_id: int | None = None,
        limit: int = Query(default=20, ge=1, le=100),
        before: datetime | None = None,
    ):
        car = await _pick_car(request, car_id)
        rows = await _store(request).recent_drives(car["id"], limit=limit, before=before)
        return {"car_id": car["id"], "drives": [_drive_row(d) for d in rows]}

    @api.get("/stream")
    async def stream(request: Request, car_id: int | None = None):
        hub = _hub(request)
        car = await _pick_car(request, car_id)
        initial = await summary(request, car["id"])
        log.info("sse client joined car=%s", car["id"])
        return EventSourceResponse(live_events(hub, initial), ping=15)

    return api


async def live_events(hub: Hub, initial: dict[str, Any]):
    """First frame is a full snapshot, then one frame per changed car state."""
    queue = hub.subscribe()
    try:
        yield {"event": "snapshot", "data": orjson.dumps(initial).decode()}
        while True:
            event = await queue.get()
            yield {"event": event["type"], "data": orjson.dumps(event["data"]).decode()}
    finally:
        hub.unsubscribe(queue)
        log.info("sse client left (%s remaining)", hub.subscribers)


def _drive_row(row: dict[str, Any]) -> dict[str, Any]:
    start, end = row.get("start_date"), row.get("end_date")
    duration = row.get("duration_min")
    if duration is None and start and end:
        duration = round((end - start).total_seconds() / 60)
    return {
        "id": row["id"],
        "start_date": as_utc(start) if start else None,
        "end_date": as_utc(end) if end else None,
        "duration_min": duration,
        "distance_km": row.get("distance"),
        "from": row.get("from_place"),
        "to": row.get("to_place"),
        "from_lat": row.get("from_lat"),
        "from_lng": row.get("from_lng"),
    }


def health_router() -> APIRouter:
    """Unauthenticated on purpose: docker healthcheck and uptime probes need it."""
    health = APIRouter()

    @health.get("/healthz")
    async def healthz(request: Request):
        db_ok = await _store(request).healthy()
        live = _live(request)
        feed = getattr(request.app.state, "mqtt", None)
        payload = {
            "status": "ok" if db_ok else "degraded",
            "database": db_ok,
            "mqtt": bool(feed and feed.connected),
            "cars_reporting": len(live.all()),
            "last_message_age_s": live.newest_age(),
            "sse_clients": _hub(request).subscribers,
        }
        return ORJSONResponse(payload, status_code=200 if db_ok else 503)

    return health
