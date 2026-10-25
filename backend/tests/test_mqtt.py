"""The broker feed: it must never take the process down, and it must be quiet
when there is no broker to talk to."""

from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.events import Hub
from app.live import LiveRegistry
from app.mqtt import MqttFeed


@pytest.mark.asyncio
async def test_an_empty_host_returns_instead_of_retrying():
    """TeslaMate does not publish mosquitto, so "no broker" is a normal setup.

    A loop that retried forever would log a warning every 30 seconds for the
    lifetime of the container, and the dashboard would work anyway."""
    feed = MqttFeed(Settings(_env_file=None, mqtt_host=""), LiveRegistry(), Hub())

    await asyncio.wait_for(feed.run(), timeout=1)
    assert feed.connected is False
