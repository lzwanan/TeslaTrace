"""HTTP surface.

Five routes, no more. Everything the home screen needs comes from
``/api/v1/summary`` in one round trip, because on a phone five parallel requests
feel worse than one slightly slower one.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import orjson
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from . import auth
from .accounts import Account, Accounts
from .events import Hub
from .live import LiveRegistry
from .store import Store
from .timeutil import as_utc, day_start

log = logging.getLogger(__name__)


def _settings(request: Request):
    return request.app.state.settings


def _store(request: Request) -> Store:
    return request.app.state.store


def _live(request: Request) -> LiveRegistry:
    return request.app.state.live


def _hub(request: Request) -> Hub:
    return request.app.state.hub


def _throttle(request: Request) -> auth.Throttle:
    """Created lazily so the guard costs nothing on an open dashboard."""
    state = request.app.state
    throttle = getattr(state, "throttle", None)
    if throttle is None:
        throttle = auth.Throttle()
        state.throttle = throttle
    return throttle


def _accounts(request: Request) -> Accounts:
    return request.app.state.accounts


def _client(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _is_https(request: Request) -> bool:
    """Behind a reverse proxy the app sees http; the forwarded header is the truth."""
    forwarded = request.headers.get("x-forwarded-proto", "").split(",")[0].strip().lower()
    return forwarded == "https" or request.url.scheme == "https"


def _signed_in(request: Request, account: Account) -> bool:
    return auth.verify(account.signing_secret, request.cookies.get(auth.COOKIE, ""))


def _state(request: Request, *, signed_in: bool | None = None) -> dict[str, Any]:
    """What the page needs to know about the door, in one shape.

    `signed_in` is passed when the response has just issued a cookie, so the answer
    describes the new session rather than the one in the request.
    """
    account = _accounts(request).current()
    if account is None:
        return {
            "required": False,
            "authenticated": True,
            "username": None,
            "default_password": False,
        }
    return {
        "required": True,
        "authenticated": _signed_in(request, account) if signed_in is None else signed_in,
        "username": account.username,
        "default_password": account.default_password,
    }


async def require_login(request: Request) -> None:
    """No account on disk means the dashboard is open, and that is allowed.

    Everything is authenticated by the session cookie. There is no query-string
    variant: a secret that travels in a URL ends up in access logs and history.
    """
    account = _accounts(request).current()
    if account is None:
        return
    if not _signed_in(request, account):
        raise HTTPException(status_code=401, detail="login required")


class Credentials(BaseModel):
    username: str
    password: str


class AuthSettings(BaseModel):
    enabled: bool
    username: str | None = None
    new_password: str | None = None
    current_password: str | None = None


def session_router() -> APIRouter:
    """Unprotected on purpose: this is how a session is obtained in the first place."""

    router_ = APIRouter(tags=["session"])

    @router_.get("/session")
    async def read_session(request: Request):
        return _state(request)

    @router_.post("/session", status_code=204)
    async def open_session(request: Request, response: Response, body: Credentials):
        accounts = _accounts(request)
        account = accounts.current()
        if account is None:
            raise HTTPException(status_code=400, detail="no login is configured")

        client = _client(request)
        throttle = _throttle(request)
        if throttle.blocked(client):
            log.warning("login throttled for %s", client)
            raise HTTPException(status_code=429, detail="too many attempts, try again in a minute")

        if not accounts.verify(body.username.strip(), body.password):
            throttle.fail(client)
            log.warning("failed login for %r from %s", body.username, client)
            raise HTTPException(status_code=401, detail="wrong username or password")

        throttle.clear(client)
        response.set_cookie(
            auth.COOKIE,
            auth.issue(account.signing_secret),
            max_age=auth.SESSION_SECONDS,
            httponly=True,
            samesite="strict",
            secure=_is_https(request),
            path="/",
        )
        log.info("session opened for %r from %s", account.username, client)

    @router_.delete("/session", status_code=204)
    async def close_session(request: Request, response: Response):
        response.delete_cookie(auth.COOKIE, path="/")
        log.info("session closed for %s", _client(request))

    return router_


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
    state = await _store(request).current_state(car_id)
    return {
        "car_id": car_id,
        "source": "db",
        # The pill reads "unknown" when this is missing, and "unknown" is the one
        # thing a car that is simply unplugged is not.
        "state": state.get("state") if state else None,
        "since": as_utc(state["start_date"]).isoformat() if state else None,
        "battery_level": position.get("battery_level"),
        "est_battery_range_km": position.get("rated_battery_range_km"),
        "rated_battery_range_km": position.get("rated_battery_range_km"),
        "odometer": position.get("odometer"),
        "latitude": position.get("latitude"),
        "longitude": position.get("longitude"),
        "speed": position.get("speed"),
        "power": position.get("power"),
        "elevation": position.get("elevation"),
        "inside_temp": position.get("inside_temp"),
        "outside_temp": position.get("outside_temp"),
        "is_climate_on": position.get("is_climate_on"),
        "updated_at": as_utc(position["date"]).timestamp(),
    }


def router() -> APIRouter:
    api = APIRouter(dependencies=[Depends(require_login)])

    @api.put("/settings/auth")
    async def update_auth(request: Request, response: Response, body: AuthSettings):
        """Turn the login on or off, change the name, change the password.

        One endpoint with three optional fields, because that is what the settings
        page submits. Changing anything on an already-protected dashboard asks for
        the current password again: a laptop left unlocked should not be enough to
        lock the owner out of their own car.
        """
        accounts = _accounts(request)
        account = accounts.current()

        if account is not None and not accounts.confirm(body.current_password or ""):
            raise HTTPException(status_code=403, detail="current password is wrong")

        username = (body.username or (account.username if account else "admin")).strip()
        if not username or len(username) > 32:
            raise HTTPException(status_code=400, detail="username must be 1-32 characters")
        password = body.new_password
        if password is not None and len(password) < 4:
            raise HTTPException(status_code=400, detail="password must be at least 4 characters")

        try:
            if not body.enabled:
                accounts.disable()
                response.delete_cookie(auth.COOKIE, path="/")
            elif account is None:
                accounts.enable(username, password or "admin")
            else:
                accounts.change(username=username, password=password)
        except RuntimeError as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

        current_account = accounts.current()
        if current_account is None:
            return _state(request)

        # Sign the person who just made the change back in with the new secret:
        # changing the password should not feel like being thrown out.
        response.set_cookie(
            auth.COOKIE,
            auth.issue(current_account.signing_secret),
            max_age=auth.SESSION_SECONDS,
            httponly=True,
            samesite="strict",
            secure=_is_https(request),
            path="/",
        )
        return _state(request, signed_in=True)

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

        tz = _tz(_settings(request))
        live_row = await _live_payload(request, car["id"])
        driving = await store.driving_stats(car["id"], tz)
        climate_hours = await store.climate_hours(car["id"], day_start(datetime.now(UTC), tz))
        drives = await store.recent_drives(car["id"], limit=3)

        return {
            "car": {**car, "label": _car_label(car), "vin_suffix": (car.get("vin") or "")[-5:]},
            "live": live_row,
            "driving": driving,
            "climate": {"hours_today": climate_hours},
            "recent_drives": [_drive_row(d) for d in drives],
        }

    @api.get("/drives")
    async def drives(
        request: Request,
        car_id: int | None = None,
        limit: int = Query(default=20, ge=1, le=100),
        before: datetime | None = None,
        # Lower bound for the month filter; None means "everything up to `before`".
        since: datetime | None = None,
    ):
        car = await _pick_car(request, car_id)
        rows = await _store(request).recent_drives(car["id"], limit=limit, before=before, since=since)
        return {"car_id": car["id"], "drives": [_drive_row(d) for d in rows]}

    @api.get("/stats")
    async def stats(
        request: Request,
        car_id: int | None = None,
        months: int = Query(default=6, ge=3, le=24),
    ):
        car = await _pick_car(request, car_id)
        tz = _tz(_settings(request))
        store = _store(request)
        # One response for the whole insights page: two batches, both cached by
        # nothing and cheap enough to run on each load.
        data = await store.stats(car["id"], tz, months)
        data.update(await store.extras(car["id"], tz))
        return data

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
        "to_lat": row.get("to_lat"),
        "to_lng": row.get("to_lng"),
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
