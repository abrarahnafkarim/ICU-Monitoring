"""
Remote Patient Monitoring System — FastAPI backend entry point.

This single app is meant to be HOSTED (e.g. on a server / cloud domain). It:
  * serves the dashboard website (the built React frontend), and
  * receives live sensor data PUSHED UP from the Raspberry Pi, and
  * relays that data to every connected browser dashboard.

Data flow:
    Raspberry Pi  --(HTTP POST /ingest/vitals)-->  this app  --(GET /latest-vitals)-->  browser
    Raspberry Pi  --(WS /ingest/ecg)----------->  this app  --(WS /ws/ecg)----------->  browser

If no Pi is connected, the app falls back to simulated data so the site still
shows a live demo.

Run (from the ``backend/`` directory):
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from api.routes import router as api_router
from websocket.camera_ws import camera_consumer, camera_producer
from websocket.camera_ws import hub as camera_hub
from websocket.ecg_ws import ecg_consumer, ecg_producer, simulation_loop
from websocket.ecg_ws import hub as ecg_hub


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start the background ECG simulation task for the app's lifetime."""
    task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Remote Patient Monitoring System",
    description="Telemedicine demo backend: live vitals + streaming ECG.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Pi (server-to-server) and any browser/dev origin to reach the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routes: GET /patient, GET /latest-vitals, POST /ingest/vitals.
app.include_router(api_router)


@app.get("/health")
def health() -> dict:
    """Health/info endpoint (also used as a connectivity check)."""
    return {
        "service": "Remote Patient Monitoring System",
        "status": "online",
        "ecg_live": ecg_hub.producer_active(),
        "camera_live": camera_hub.producer_active(),
        "endpoints": [
            "/patient",
            "/latest-vitals",
            "/ingest/vitals",
            "/ws/ecg",
            "/ingest/ecg",
            "/ws/camera",
            "/ingest/camera",
        ],
    }


@app.websocket("/ws/ecg")
async def websocket_ecg(websocket: WebSocket) -> None:
    """Browser dashboard subscribes here to receive the ECG stream."""
    await ecg_consumer(websocket)


@app.websocket("/ingest/ecg")
async def websocket_ingest_ecg(websocket: WebSocket) -> None:
    """The Raspberry Pi pushes its ECG stream here."""
    await ecg_producer(websocket)


@app.websocket("/ws/camera")
async def websocket_camera(websocket: WebSocket) -> None:
    """Browser dashboard subscribes here to receive the camera feed."""
    await camera_consumer(websocket)


@app.websocket("/ingest/camera")
async def websocket_ingest_camera(websocket: WebSocket) -> None:
    """The Raspberry Pi pushes its webcam frames here."""
    await camera_producer(websocket)


# --------------------------------------------------------------------------- #
# Serve the built dashboard (optional). Looked up in priority order:
#   1. $RPM_STATIC_DIR
#   2. ./static            (copy frontend/dist here when deploying)
#   3. ../frontend/dist    (the repo layout on your dev machine)
# --------------------------------------------------------------------------- #
def _find_static_dir() -> str | None:
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.environ.get("RPM_STATIC_DIR"),
        os.path.join(here, "static"),
        os.path.join(here, "..", "frontend", "dist"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(os.path.join(candidate, "index.html")):
            return os.path.realpath(candidate)
    return None


STATIC_DIR = _find_static_dir()

if STATIC_DIR is not None:
    _INDEX = os.path.join(STATIC_DIR, "index.html")

    @app.get("/{full_path:path}")
    def serve_dashboard(full_path: str) -> FileResponse:
        """
        Serve the dashboard. Real files (JS/CSS/assets) are returned directly;
        any other path falls back to index.html so client-side routes like
        /dashboard keep working on a page refresh (single-page app).
        """
        requested = os.path.realpath(os.path.join(STATIC_DIR, full_path))
        if (
            full_path
            and requested.startswith(STATIC_DIR)  # block path traversal
            and os.path.isfile(requested)
        ):
            return FileResponse(requested)
        return FileResponse(_INDEX)
else:

    @app.get("/")
    def root() -> dict:
        """No built frontend found — point callers at the API docs."""
        return {
            "service": "Remote Patient Monitoring System",
            "status": "online (API only — no built frontend found)",
            "hint": "Build the frontend (npm run build) and copy dist/ to backend/static/",
            "endpoints": ["/patient", "/latest-vitals", "/ws/ecg", "/docs"],
        }
