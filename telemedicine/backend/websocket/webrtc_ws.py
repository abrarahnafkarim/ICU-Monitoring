"""
WebRTC signaling broker (video feed — Option B).

A pure message router between ONE publisher (the Raspberry Pi, running aiortc)
and N viewers (browsers). The actual video flows **peer-to-peer** (or via a
TURN relay) — it does NOT pass through this server. Only SDP offers/answers are
relayed here, which is tiny, so it runs comfortably even on a free host.

We use **non-trickle ICE**: each peer finishes ICE gathering before sending its
SDP, so candidates are embedded in the offer/answer and there are no separate
candidate messages to route.

Endpoints:
  /webrtc/publisher  — the Pi (token-protected)
  /webrtc/viewer     — a browser viewer

Message flow:
  viewer connects            -> server tells publisher  {type:"viewer-join","viewer":id}
  publisher creates offer    -> {type:"offer","viewer":id,"sdp":...} -> routed to that viewer
  viewer answers             -> {type:"answer","sdp":...} -> server tags viewer id -> publisher
  viewer/publisher leaves     -> the other side is notified
"""

from __future__ import annotations

import uuid
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from state import check_token


class SignalHub:
    """Holds the single publisher and the set of viewers."""

    def __init__(self) -> None:
        self.publisher: Optional[WebSocket] = None
        self.viewers: Dict[str, WebSocket] = {}


hub = SignalHub()


async def _safe_send(ws: Optional[WebSocket], message: dict) -> None:
    if ws is None:
        return
    try:
        await ws.send_json(message)
    except Exception:
        pass


async def publisher_endpoint(websocket: WebSocket) -> None:
    """The Raspberry Pi connects here to publish its camera."""
    if not check_token(websocket.query_params.get("token")):
        await websocket.close(code=4401)  # unauthorized
        return

    await websocket.accept()
    hub.publisher = websocket

    # Catch the publisher up on viewers that are already waiting.
    for viewer_id in list(hub.viewers.keys()):
        await _safe_send(websocket, {"type": "viewer-join", "viewer": viewer_id})

    try:
        while True:
            message = await websocket.receive_json()
            viewer_id = message.get("viewer")
            target = hub.viewers.get(viewer_id) if viewer_id else None
            if target is not None:
                # Forward offer/etc. to that viewer (drop the routing field).
                await _safe_send(
                    target, {k: v for k, v in message.items() if k != "viewer"}
                )
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if hub.publisher is websocket:
            hub.publisher = None
        for viewer in list(hub.viewers.values()):
            await _safe_send(viewer, {"type": "publisher-gone"})


async def viewer_endpoint(websocket: WebSocket) -> None:
    """A browser connects here to receive the camera feed."""
    await websocket.accept()
    viewer_id = uuid.uuid4().hex[:8]
    hub.viewers[viewer_id] = websocket

    if hub.publisher is not None:
        await _safe_send(hub.publisher, {"type": "viewer-join", "viewer": viewer_id})
    else:
        await _safe_send(websocket, {"type": "no-publisher"})

    try:
        while True:
            message = await websocket.receive_json()
            # Forward the viewer's answer to the publisher, tagged with its id.
            message["viewer"] = viewer_id
            await _safe_send(hub.publisher, message)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        hub.viewers.pop(viewer_id, None)
        await _safe_send(hub.publisher, {"type": "viewer-leave", "viewer": viewer_id})
