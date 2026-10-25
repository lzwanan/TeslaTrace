from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.accounts import Accounts
from app.api import live_events
from app.config import Settings
from app.events import Hub
from app.live import LiveRegistry
from app.main import create_app

# TeslaMate stores naive UTC timestamps; these mirror what psycopg returns.
START = datetime(2026, 10, 23, 9, 32, 54, 129000)
END = datetime(2026, 10, 23, 9, 57, 17, 352000)

NAMED_CAR = {
    "id": 1,
    "model": "3",
    "name": "初号机",
    "marketing_name": "RWD",
    "trim_badging": "50",
    "vin": "TESTCAR0000000001",
}
UNNAMED_CAR = {"id": 2, "model": "3", "name": None, "marketing_name": None, "trim_badging": "50", "vin": "TESTCAR0000000002"}


class FakeStore:
    """Stands in for the read-only queries; no database involved."""

    def __init__(self, cars=None, position=None, healthy=True, duration_min=24):
        self._cars = cars if cars is not None else [NAMED_CAR]
        self._position = position
        self._healthy = healthy
        self._duration_min = duration_min

    async def cars(self):
        return self._cars

    async def driving_stats(self, car_id, tz, now=None):
        return {"today_drives": 2, "today_km": 42.6, "month_drives": 38, "month_km": 1284.0}

    async def current_state(self, car_id):
        return {"state": "offline", "start_date": START}

    async def recent_drives(self, car_id, limit=20, before=None, since=None):
        self.last_since = since
        return [
            {
                "id": 900,
                "start_date": START,
                "end_date": END,
                "duration_min": self._duration_min,
                "distance": 21.8,
                "from_place": None,
                "to_place": "家",
                "from_lat": 39.9,
                "from_lng": 116.4,
            }
        ][:limit]

    async def climate_hours(self, car_id, since):
        return 2.75

    async def last_position(self, car_id):
        return self._position

    async def healthy(self):
        return self._healthy


def make_client(*, settings=None, store=None, live=None, connected=True, accounts=None) -> TestClient:
    settings = settings or Settings(_env_file=None)
    app = create_app(settings)

    @asynccontextmanager
    async def fake_lifespan(app_):
        app_.state.settings = settings
        app_.state.store = store or FakeStore()
        app_.state.live = live or LiveRegistry()
        app_.state.hub = Hub()
        app_.state.accounts = accounts if accounts is not None else Accounts(None)
        app_.state.mqtt = SimpleNamespace(connected=connected)
        yield

    app.router.lifespan_context = fake_lifespan
    return TestClient(app)


def test_healthz_reports_dependencies():
    with make_client() as client:
        response = client.get("/healthz")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] is True
    assert body["mqtt"] is True
    assert body["last_message_age_s"] is None


def test_healthz_degrades_without_database():
    with make_client(store=FakeStore(healthy=False)) as client:
        response = client.get("/healthz")

    assert response.status_code == 503
    assert response.json()["status"] == "degraded"


def test_car_label_prefers_the_nickname_from_teslamate():
    with make_client() as client:
        body = client.get("/api/v1/cars").json()

    assert body[0]["label"] == "初号机"
    assert body[0]["vin_suffix"] == "00001"


def test_unnamed_car_falls_back_to_model_and_trim():
    with make_client(store=FakeStore(cars=[UNNAMED_CAR])) as client:
        body = client.get("/api/v1/cars").json()

    assert body[0]["label"] == "Model 3 50"


def test_live_falls_back_to_last_position_before_mqtt_arrives():
    position = {
        "date": START,
        "latitude": 39.91,
        "longitude": 116.40,
        "speed": 0,
        "power": 0,
        "battery_level": 68,
        "rated_battery_range_km": 342.0,
        "odometer": 23486.0,
        "inside_temp": 21.5,
        "outside_temp": 9.0,
        "is_climate_on": True,
    }
    with make_client(store=FakeStore(position=position)) as client:
        body = client.get("/api/v1/summary").json()

    assert body["live"]["source"] == "db"
    assert body["live"]["battery_level"] == 68
    # Tesla no longer fills est_battery_range_km; the rated figure is the one the
    # card shows, so it has to survive the fallback under both names.
    assert body["live"]["rated_battery_range_km"] == 342.0
    assert body["live"]["est_battery_range_km"] == 342.0
    # A parked car can still say how warm it is, without a broker.
    assert body["live"]["inside_temp"] == 21.5
    assert body["live"]["outside_temp"] == 9.0
    assert body["live"]["is_climate_on"] is True
    # "unknown" was the one thing a simply parked car was not: TeslaMate records
    # every transition, so the pill can say offline and since when.
    assert body["live"]["state"] == "offline"
    assert body["live"]["since"] == "2026-10-23T09:32:54.129000+00:00"
    # Naive UTC from the database must come back as an explicit UTC timestamp.
    assert body["live"]["updated_at"] == datetime(2026, 10, 23, 9, 32, 54, 129000, tzinfo=UTC).timestamp()


def test_summary_prefers_mqtt_state():
    live = LiveRegistry()
    live.get(1).apply("teslamate/cars/1/battery_level", "72")
    live.get(1).apply("teslamate/cars/1/state", "charging")

    with make_client(live=live) as client:
        body = client.get("/api/v1/summary").json()

    assert body["live"]["source"] == "mqtt"
    assert body["live"]["battery_level"] == 72.0
    assert body["live"]["state"] == "charging"
    assert body["driving"]["today_km"] == 42.6
    assert body["climate"] == {"hours_today": 2.75}
    assert body["car"]["label"] == "初号机"
    assert len(body["recent_drives"]) == 1


def test_drive_times_are_serialized_as_utc():
    with make_client() as client:
        drive = client.get("/api/v1/drives").json()["drives"][0]

    assert drive["duration_min"] == 24  # taken from TeslaMate's own column
    assert drive["distance_km"] == 21.8
    assert drive["start_date"].endswith("Z") or drive["start_date"].endswith("+00:00")
    assert drive["from"] is None
    assert drive["to"] == "家"


def test_drive_duration_is_derived_when_the_column_is_null():
    with make_client(store=FakeStore(duration_min=None)) as client:
        drive = client.get("/api/v1/drives").json()["drives"][0]

    assert drive["duration_min"] == 24  # 09:32:54 -> 09:57:17 rounded


def test_drives_month_filter_reaches_the_store():
    store = FakeStore()
    with make_client(store=store) as client:
        client.get("/api/v1/drives", params={"since": "2026-10-01T00:00:00Z"})

    assert store.last_since is not None
    assert store.last_since.year == 2026 and store.last_since.month == 10


def test_missing_car_is_a_404():
    with make_client(store=FakeStore(cars=[])) as client:
        response = client.get("/api/v1/summary")

    assert response.status_code == 404


def test_a_login_guards_the_api_but_not_healthz(locked):
    with make_client(accounts=locked) as client:
        assert client.get("/healthz").status_code == 200
        assert client.get("/api/v1/cars").status_code == 401


def test_stream_is_routed_and_404s_without_a_car():
    with make_client(store=FakeStore(cars=[])) as client:
        assert client.get("/api/v1/stream").status_code == 404


async def test_event_stream_sends_a_snapshot_then_patches_and_unsubscribes():
    hub = Hub()
    stream = live_events(hub, {"car": {"id": 1}, "live": {"source": "db"}})

    first = await anext(stream)
    assert first["event"] == "snapshot"
    assert json.loads(first["data"])["car"]["id"] == 1
    assert hub.subscribers == 1

    hub.publish("live", {"car_id": 1, "battery_level": 70.0})
    second = await anext(stream)
    assert second["event"] == "live"
    assert json.loads(second["data"])["battery_level"] == 70.0

    await stream.aclose()
    assert hub.subscribers == 0
