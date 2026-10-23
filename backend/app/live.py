"""Live car state, fed by MQTT.

TeslaMate publishes each attribute as its own topic, so a snapshot is built by
merging many small messages. Two rules matter:

1. An empty payload, ``null`` or the literal string ``nil`` means "unknown" and
   must NOT overwrite a value we already have. TeslaMate publishes ``nil`` for
   fields the car did not report; overwriting would blank the UI.
2. Values are coerced at the edge (bool / float / int) so routes never parse.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

# Topics we keep. Everything else TeslaMate publishes is ignored on purpose.
NUMERIC = {
    "battery_level": float,
    "usable_battery_level": float,
    "est_battery_range_km": float,
    "rated_battery_range_km": float,
    "ideal_battery_range_km": float,
    "speed": float,
    "power": float,
    "odometer": float,
    "inside_temp": float,
    "outside_temp": float,
    "charge_energy_added": float,
    "charge_limit_soc": float,
    "charger_power": float,
    "charger_actual_current": float,
    "charger_voltage": float,
    "time_to_full_charge": float,
    "latitude": float,
    "longitude": float,
    "elevation": float,
}
BOOLEAN = {"locked", "sentry_mode", "plugged_in", "is_climate_on", "healthy", "update_available"}
TEXT = {"state", "since", "display_name", "geofence", "shift_state", "version", "charging_state"}

EMPTY = {"", "null", "nil", "none"}


@dataclass(slots=True)
class LiveState:
    car_id: int
    values: dict[str, Any] = field(default_factory=dict)
    updated_at: float = 0.0
    seq: int = 0

    def apply(self, topic: str, payload: str) -> bool:
        """Merge one MQTT message. Returns True when the snapshot changed."""
        key = topic.rsplit("/", 1)[-1]
        if key == "location":
            return self._apply_location(payload)
        if key not in NUMERIC and key not in BOOLEAN and key not in TEXT:
            return False

        raw = payload.strip()
        if raw.lower() in EMPTY:
            return False

        value: Any
        if key in NUMERIC:
            try:
                value = float(raw)
            except ValueError:
                return False
        elif key in BOOLEAN:
            value = raw.lower() == "true"
        else:
            value = raw

        if self.values.get(key) == value:
            return False
        self.values[key] = value
        self.touch()
        return True

    def _apply_location(self, payload: str) -> bool:
        import json

        try:
            data = json.loads(payload)
        except ValueError:
            return False
        lat, lng = data.get("latitude"), data.get("longitude")
        if lat is None or lng is None:
            return False
        if self.values.get("latitude") == lat and self.values.get("longitude") == lng:
            return False
        self.values["latitude"] = float(lat)
        self.values["longitude"] = float(lng)
        self.touch()
        return True

    def touch(self) -> None:
        self.updated_at = time.time()
        self.seq += 1

    def snapshot(self) -> dict[str, Any]:
        return {"car_id": self.car_id, **self.values, "updated_at": self.updated_at}

    @property
    def is_fresh(self) -> bool:
        return self.updated_at > 0


class LiveRegistry:
    """One LiveState per car id, created on first message."""

    def __init__(self) -> None:
        self._cars: dict[int, LiveState] = {}

    def get(self, car_id: int) -> LiveState:
        state = self._cars.get(car_id)
        if state is None:
            state = self._cars[car_id] = LiveState(car_id=car_id)
        return state

    def snapshot(self, car_id: int) -> dict[str, Any]:
        return self.get(car_id).snapshot()

    def all(self) -> list[dict[str, Any]]:
        return [s.snapshot() for s in self._cars.values()]

    def newest_age(self) -> float | None:
        """Seconds since any car reported — used by /healthz."""
        stamps = [s.updated_at for s in self._cars.values() if s.updated_at > 0]
        return round(time.time() - max(stamps), 1) if stamps else None
