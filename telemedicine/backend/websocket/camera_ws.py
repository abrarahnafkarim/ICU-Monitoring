"""
Live camera relay hub.

Mirrors the ECG hub, but for the webcam video feed. Frames are JPEG-encoded
binary blobs (no transcoding on the server — it just forwards bytes):

  * **Consumer** — the browser dashboard. Connects to ``/ws/camera`` and
    receives JPEG frames (one binary message per frame).
  * **Producer** — the Raspberry Pi. Connects to ``/ingest/camera`` and pushes
    JPEG frames up.

The most recent frame is cached so a dashboard that connects mid-stream shows
an image immediately instead of a blank box. There is no simulation fallback
(unlike ECG) — the UI shows a "waiting for camera" placeholder until the Pi's
``pi_camera.py`` starts streaming.

Note on hosting: relaying video doubles server egress (Pi -> server -> browser)
and is CPU-light but bandwidth-heavy. Keep the resolution/FPS modest on small
hosts (see pi_camera.py defaults: 640x480 @ ~10 fps).
"""

from __future__ import annotations

import time
from typing import Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from state import check_token

# Seconds without a pushed frame before the feed is considered inactive.
PRODUCER_TIMEOUT = 3.0


class CameraHub:
    """Tracks dashboard subscribers and forwards JPEG frames to them."""

    def __init__(self) -> None:
        self.consumers: Set[WebSocket] = set()
        self.latest_frame: Optional[bytes] = None
        self._last_producer_ts = 0.0

    def producer_active(self) -> bool:
        return (time.time() - self._last_producer_ts) < PRODUCER_TIMEOUT

    def mark_producer(self) -> None:
        self._last_producer_ts = time.time()

    async def broadcast(self, frame: bytes) -> None:
        """Cache the frame and send it to every connected dashboard."""
        self.latest_frame = frame
        for ws in list(self.consumers):
            try:
                await ws.send_bytes(frame)
            except Exception:
                self.consumers.discard(ws)


hub = CameraHub()


async def camera_consumer(websocket: WebSocket) -> None:
    """Browser dashboard: subscribe and receive JPEG frames until disconnect."""
    await websocket.accept()
    hub.consumers.add(websocket)

    # Show the last known frame immediately so the card isn't blank.
    if hub.latest_frame is not None:
        try:
            await websocket.send_bytes(hub.latest_frame)
        except Exception:
            pass

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


async def camera_producer(websocket: WebSocket) -> None:
    """Raspberry Pi: receive JPEG frames and fan them out to dashboards."""
    if not check_token(websocket.query_params.get("token")):
        await websocket.close(code=4401)  # unauthorized
        return

    await websocket.accept()
    hub.mark_producer()
    try:
        while True:
            frame = await websocket.receive_bytes()
            hub.mark_producer()
            await hub.broadcast(frame)
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
