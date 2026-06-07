"""
Real-time ECG hub.

Fans out ECG sample batches to every connected browser dashboard. There are
two kinds of WebSocket client:

  * **Consumer** — the browser dashboard. Connects to ``/ws/ecg`` and only
    receives sample batches.
  * **Producer** — the Raspberry Pi. Connects to ``/ingest/ecg`` and pushes
    real ECG batches up to the server.

If no producer is pushing, a background task generates simulated ECG so the
dashboard always shows a live trace (handy before the Pi is wired up). As soon
as the Pi starts pushing, the simulation steps aside automatically.

Every outgoing sample is re-timestamped with the hub's own monotonic clock, so
the scrolling x-axis stays smooth whether the data is simulated or from the Pi.
"""

from __future__ import annotations

import time
from typing import List, Set

from fastapi import WebSocket, WebSocketDisconnect

from sensors import ad8232
from state import check_token

BATCH_SIZE = 10
BATCH_INTERVAL = BATCH_SIZE / ad8232.SAMPLE_RATE  # seconds (10/250 = 0.04s)
PRODUCER_TIMEOUT = 1.5  # seconds without Pi data before simulation resumes


class EcgHub:
    """Tracks dashboard subscribers and broadcasts ECG batches to them."""

    def __init__(self, sample_rate: int) -> None:
        self.sample_rate = sample_rate
        self.consumers: Set[WebSocket] = set()
        self._sample_index = 0
        self._last_producer_ts = 0.0

    def producer_active(self) -> bool:
        """True if the Pi has pushed data within the timeout window."""
        return (time.time() - self._last_producer_ts) < PRODUCER_TIMEOUT

    def mark_producer(self) -> None:
        self._last_producer_ts = time.time()

    async def broadcast(self, values: List[float]) -> None:
        """Re-timestamp a batch of amplitudes and send to all dashboards."""
        if not self.consumers:
            self._sample_index += len(values)  # keep time monotonic
            return

        samples = []
        for value in values:
            samples.append(
                {
                    "t": round(self._sample_index / self.sample_rate, 4),
                    "v": round(float(value), 4),
                }
            )
            self._sample_index += 1

        message = {"sample_rate": self.sample_rate, "samples": samples}
        for ws in list(self.consumers):
            try:
                await ws.send_json(message)
            except Exception:
                self.consumers.discard(ws)


hub = EcgHub(ad8232.SAMPLE_RATE)


async def simulation_loop() -> None:
    """Emit simulated ECG whenever the Pi isn't actively pushing real data."""
    import asyncio

    while True:
        if hub.consumers and not hub.producer_active():
            values = [ad8232.read_ecg_sample() for _ in range(BATCH_SIZE)]
            await hub.broadcast(values)
        await asyncio.sleep(BATCH_INTERVAL)


async def ecg_consumer(websocket: WebSocket) -> None:
    """Browser dashboard: subscribe and receive batches until disconnect."""
    await websocket.accept()
    hub.consumers.add(websocket)
    try:
        while True:
            # Dashboards don't send anything; this just waits for the close.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.consumers.discard(websocket)


async def ecg_producer(websocket: WebSocket) -> None:
    """Raspberry Pi: receive ECG batches and fan them out to dashboards."""
    if not check_token(websocket.query_params.get("token")):
        await websocket.close(code=4401)  # unauthorized
        return

    await websocket.accept()
    hub.mark_producer()
    try:
        while True:
            data = await websocket.receive_json()
            values = data.get("values")
            if values is None and "samples" in data:
                values = [s.get("v", 0.0) for s in data["samples"]]
            if values:
                hub.mark_producer()
                await hub.broadcast(values)
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
