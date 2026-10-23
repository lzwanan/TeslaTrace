from __future__ import annotations

from app.events import Hub


def test_publish_reaches_every_subscriber():
    hub = Hub()
    a, b = hub.subscribe(), hub.subscribe()

    hub.publish("live", {"battery_level": 68})

    assert a.get_nowait() == {"type": "live", "data": {"battery_level": 68}}
    assert b.get_nowait() == {"type": "live", "data": {"battery_level": 68}}
    assert hub.subscribers == 2


def test_slow_client_loses_oldest_frame_not_newest():
    hub = Hub(queue_size=2)
    queue = hub.subscribe()

    for level in (10, 20, 30):
        hub.publish("live", {"battery_level": level})

    # The 10% frame is stale by the time the client reads it; 30% is what matters.
    assert queue.get_nowait()["data"]["battery_level"] == 20
    assert queue.get_nowait()["data"]["battery_level"] == 30
    assert queue.empty()


def test_unsubscribe_stops_delivery():
    hub = Hub()
    queue = hub.subscribe()
    hub.unsubscribe(queue)

    hub.publish("live", {"battery_level": 1})

    assert queue.empty()
    assert hub.subscribers == 0


def test_publish_without_subscribers_is_a_no_op():
    Hub().publish("live", {"battery_level": 1})  # must not raise
