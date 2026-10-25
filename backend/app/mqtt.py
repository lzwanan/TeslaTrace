"""MQTT feed.

TeslaMate publishes one topic per attribute. We merge them into per-car state and
push the changed snapshot to every SSE subscriber. Nothing here polls the car or
the database — the broker is the only source, so a sleeping car costs zero.
"""

from __future__ import annotations

import asyncio
import logging

import aiomqtt

from .config import Settings
from .events import Hub
from .live import LiveRegistry

log = logging.getLogger(__name__)

TOPIC_FILTER = "teslamate/cars/+/#"
MAX_BACKOFF = 30.0


class MqttFeed:
    """Owns the broker connection and its reconnect loop."""

    def __init__(self, settings: Settings, live: LiveRegistry, hub: Hub) -> None:
        self._settings = settings
        self._live = live
        self._hub = hub
        self.connected = False

    async def run(self) -> None:
        # An unexposed broker is a normal deployment, not a fault: TeslaMate keeps
        # mosquitto on its own compose network and only publishes the web port, so
        # the dashboard falls back to the newest row in `positions`. Retrying every
        # 30 seconds forever would turn that into a wall of warnings.
        if not self._settings.mqtt_host:
            log.info("MQTT_HOST is empty — live state comes from the database only")
            return

        backoff = 1.0
        while True:
            try:
                async with aiomqtt.Client(**self._settings.mqtt_client_kwargs) as client:
                    await client.subscribe(TOPIC_FILTER, qos=1)
                    self.connected = True
                    backoff = 1.0
                    log.info("mqtt connected to %s:%s", self._settings.mqtt_host, self._settings.mqtt_port)
                    async for message in client.messages:
                        self._handle(str(message.topic), message.payload)
            except asyncio.CancelledError:
                self.connected = False
                raise
            except Exception as exc:  # noqa: BLE001 - a broken broker must not kill the app
                self.connected = False
                log.warning("mqtt disconnected (%s), retrying in %.0fs", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF)

    def _handle(self, topic: str, payload: object) -> None:
        parts = topic.split("/")
        if len(parts) < 4:
            return
        try:
            car_id = int(parts[2])
        except ValueError:
            return

        text = payload.decode() if isinstance(payload, bytes) else str(payload)
        changed = self._live.get(car_id).apply(topic, text)
        if not changed:
            return

        key = parts[-1]
        state = self._live.get(car_id)
        if key == "state":
            log.info("car %s state -> %s", car_id, state.values.get("state"))
        self._hub.publish("live", state.snapshot())
