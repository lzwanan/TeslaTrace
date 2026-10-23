"""Server-sent event fan-out.

One bounded queue per connected browser. When a client falls behind we drop its
oldest frame instead of blocking the producer: a stale snapshot is worth less
than a fresh one, and nobody wants the MQTT loop to stall because a phone went
to sleep with a half-open connection.
"""

from __future__ import annotations

import asyncio
from typing import Any


class Hub:
    def __init__(self, queue_size: int = 8) -> None:
        self._queues: set[asyncio.Queue] = set()
        self._queue_size = queue_size

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=self._queue_size)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._queues.discard(queue)

    def publish(self, event_type: str, data: Any) -> None:
        if not self._queues:
            return
        event = {"type": event_type, "data": data}
        for queue in self._queues:
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:  # pragma: no cover - race, harmless
                    pass
            queue.put_nowait(event)

    @property
    def subscribers(self) -> int:
        return len(self._queues)
