"""
Raspberry Pi camera sender — RUN THIS ON THE PI (alongside pi_sender.py).

Captures webcam frames with OpenCV, JPEG-encodes them, and streams them up to
the hosted dashboard over a WebSocket (``/ingest/camera``). The server relays
each frame to the browser, which draws it in the Patient Camera card.

Keep the resolution/FPS modest on small hosts (free tiers) — video is far
heavier than the sensor data. The defaults (640x480 @ ~10 fps, JPEG q70) are a
good balance for a demo.

Configure with environment variables:
    RPM_SERVER          hosted app URL, e.g. https://your-app.example.com
    RPM_INGEST_TOKEN    shared secret matching the server (recommended)
    RPM_CAMERA_INDEX    OpenCV camera index (default 0; USB webcam = 0)
    RPM_CAMERA_WIDTH    frame width  (default 640)
    RPM_CAMERA_HEIGHT   frame height (default 480)
    RPM_CAMERA_FPS      frames per second (default 10)
    RPM_CAMERA_QUALITY  JPEG quality 1-100 (default 70)

Run:
    RPM_SERVER=https://your-app.example.com RPM_INGEST_TOKEN=secret python pi_camera.py
"""

from __future__ import annotations

import asyncio
import os

import cv2
import websockets

SERVER = os.environ.get("RPM_SERVER", "http://localhost:8000").rstrip("/")
TOKEN = os.environ.get("RPM_INGEST_TOKEN", "")

WS_URL = SERVER.replace("http", "ws", 1) + "/ingest/camera"
if TOKEN:
    WS_URL += f"?token={TOKEN}"

CAMERA_INDEX = int(os.environ.get("RPM_CAMERA_INDEX", "0"))
WIDTH = int(os.environ.get("RPM_CAMERA_WIDTH", "640"))
HEIGHT = int(os.environ.get("RPM_CAMERA_HEIGHT", "480"))
FPS = float(os.environ.get("RPM_CAMERA_FPS", "10"))
QUALITY = int(os.environ.get("RPM_CAMERA_QUALITY", "70"))


def _open_camera() -> "cv2.VideoCapture":
    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera at index {CAMERA_INDEX}")
    return cap


async def stream() -> None:
    cap = _open_camera()
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), QUALITY]
    interval = 1.0 / FPS
    loop = asyncio.get_event_loop()

    def grab_jpeg() -> bytes | None:
        """Blocking capture + encode (run in a thread to keep the loop free)."""
        ok, frame = cap.read()
        if not ok:
            return None
        ok, buffer = cv2.imencode(".jpg", frame, encode_params)
        return buffer.tobytes() if ok else None

    try:
        while True:
            try:
                async with websockets.connect(WS_URL, max_size=None) as ws:
                    print(f"[camera] streaming to {WS_URL} ({WIDTH}x{HEIGHT} @ {FPS} fps)")
                    while True:
                        jpeg = await loop.run_in_executor(None, grab_jpeg)
                        if jpeg is not None:
                            await ws.send(jpeg)
                        await asyncio.sleep(interval)
            except Exception as exc:
                print(f"[camera] connection lost ({exc}); retrying in 2 s")
                await asyncio.sleep(2)
    finally:
        cap.release()


if __name__ == "__main__":
    print(f"Streaming webcam to {SERVER}")
    try:
        asyncio.run(stream())
    except KeyboardInterrupt:
        print("\nStopped.")
