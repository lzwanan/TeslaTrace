from __future__ import annotations

from app.live import LiveRegistry

CAR = "teslamate/cars/1"


def test_numeric_and_boolean_are_coerced():
    live = LiveRegistry().get(1)

    assert live.apply(f"{CAR}/battery_level", "68") is True
    assert live.apply(f"{CAR}/locked", "true") is True
    assert live.apply(f"{CAR}/speed", "0") is True

    values = live.values
    assert values["battery_level"] == 68.0
    assert isinstance(values["battery_level"], float)
    assert values["locked"] is True
    assert values["speed"] == 0.0


def test_unknown_values_never_overwrite_known_ones():
    """TeslaMate publishes `nil` for fields the car did not report."""
    live = LiveRegistry().get(1)
    live.apply(f"{CAR}/speed", "42.5")

    for payload in ("nil", "null", "", "  ", "None"):
        assert live.apply(f"{CAR}/speed", payload) is False

    assert live.values["speed"] == 42.5


def test_same_value_does_not_bump_sequence():
    live = LiveRegistry().get(1)
    live.apply(f"{CAR}/battery_level", "68")
    seq = live.seq

    assert live.apply(f"{CAR}/battery_level", "68.0") is False
    assert live.seq == seq


def test_location_blob_is_unpacked():
    live = LiveRegistry().get(1)

    assert live.apply(f"{CAR}/location", '{"latitude": 39.9, "longitude": 116.4}') is True
    assert live.values["latitude"] == 39.9
    assert live.values["longitude"] == 116.4


def test_location_without_coordinates_is_ignored():
    live = LiveRegistry().get(1)

    assert live.apply(f"{CAR}/location", '{"latitude": null, "longitude": null}') is False
    assert live.apply(f"{CAR}/location", "not json") is False
    assert "latitude" not in live.values


def test_irrelevant_topics_are_ignored():
    live = LiveRegistry().get(1)

    assert live.apply(f"{CAR}/charge_port_latch_engaged", "true") is False
    assert live.values == {}


def test_registry_creates_state_per_car_and_reports_age():
    registry = LiveRegistry()
    registry.get(2).apply("teslamate/cars/2/state", "charging")

    assert registry.snapshot(2)["state"] == "charging"
    assert len(registry.all()) == 1
    assert registry.newest_age() is not None
    assert LiveRegistry().newest_age() is None
