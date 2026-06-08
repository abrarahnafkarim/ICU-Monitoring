# Project Handoff — Remote Patient Monitoring System

> **For the next agent (Antigravity / Claude Opus).** This is a self-contained
> brief. Read it fully before editing. The project is **working and deployed**;
> the active task is finishing the **WebRTC video feed (Option B)**, which is
> ~30% done. Preserve the invariants in §8 — they are easy to break.

---

## 1. Mission & what this is

A telemedicine remote patient-monitoring **demo** (university engineering
project). One demo patient ("Abrar Ahnaf"). A **Raspberry Pi reads sensors +
webcam and pushes the data UP** to a hosted app, which serves a polished
dark-mode dashboard (PWA) and relays live data to browsers.

Single patient. No DB, no real auth (hardcoded `admin`/`admin123`), no
multi-user. The point is a clean, professional, installable dashboard fed by a
real Pi.

---

## 2. Tech stack & where things run

| Part | Tech | Hosted on |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite + TailwindCSS + React Router + Plotly + PWA (`vite-plugin-pwa`) | **Vercel** (static) |
| Backend | FastAPI + Python 3.11 + WebSockets | **Render** (free web service) |
| Pi senders | Python scripts pushing data out | the **Raspberry Pi** |

- **GitHub repo:** `abrarahnafkarim/ICU-Monitoring`, branch `main`. Repo root
  contains the `telemedicine/` folder.
- **Render backend URL:** `https://rpm-backend-vleu.onrender.com`
- **Render Blueprint:** `render.yaml` at the **repo root**, `rootDir: telemedicine/backend`.
- **Vercel:** Root Directory = `telemedicine/frontend`; `vercel.json` provides SPA rewrites.

---

## 3. Repo layout (key files)

```
ICU monitoring System/
├── render.yaml                 # Render Blueprint (repo root, rootDir=telemedicine/backend)
├── HANDOFF.md                  # this file
└── telemedicine/
    ├── README.md  HARDWARE.md  # full docs (read these too)
    ├── backend/
    │   ├── main.py             # FastAPI app: routes + WS + serves built frontend
    │   ├── state.py            # in-memory latest-vitals store + check_token()
    │   ├── api/routes.py       # GET /patient, /latest-vitals; POST /ingest/vitals
    │   ├── websocket/
    │   │   ├── ecg_ws.py       # ECG hub: /ws/ecg (browser) + /ingest/ecg (Pi) + sim fallback
    │   │   ├── camera_ws.py    # JPEG camera hub (Option A): /ws/camera + /ingest/camera
    │   │   └── webrtc_ws.py    # ⏳ WebRTC signaling broker (Option B) — DONE, not yet wired
    │   ├── sensors/            # ad8232, ecg_simulator, max30102, mlx90614 (sim now; HW later)
    │   ├── pi_sender.py        # RUN ON PI: pushes vitals (HTTP) + ECG (WS)
    │   ├── pi_camera.py        # RUN ON PI: pushes JPEG webcam frames (Option A)
    │   ├── requirements.txt        # server deps (fastapi, uvicorn[standard])
    │   └── requirements-pi.txt     # Pi deps (websockets, opencv, hardware drivers)
    └── frontend/
        ├── vite.config.ts      # VitePWA config (manifest, workbox, pwaAssets)
        ├── vercel.json          # SPA rewrites
        ├── public/app-icon.svg  # PWA icon source
        └── src/
            ├── config.ts        # API/WS URLs (strips trailing slash), demo creds
            ├── api/client.ts     # typed fetch wrapper
            ├── auth/AuthContext.tsx
            ├── hooks/            # useVitals, usePatient, useEcgStream, useCameraStream, useClock
            ├── lib/alerts.ts     # alert threshold rules
            ├── components/       # Navbar, MetricCard, VitalsGrid, EcgChart, CameraFeed,
            │                     #   SensorStatusPanel, AlertPanel, InstallButton, ui/*
            └── pages/            # Login, PatientList, Dashboard
```

---

## 4. Architecture & data flow (do not violate)

```text
 Raspberry Pi  ──POST /ingest/vitals──►  Render FastAPI  ──GET /latest-vitals──►  Browser (Vercel)
 (pi_sender,   ──WS   /ingest/ecg─────►  (single         ──WS   /ws/ecg────────►  dashboard
  pi_camera,   ──WS   /ingest/camera──►   instance)       ──WS   /ws/camera─────►
  pi_webrtc)   ──WS   /webrtc/publisher► (signaling only) ◄─WS  /webrtc/viewer──►  (media is P2P!)
```

- The Pi is a **client that pushes out** (it can't be reached behind home NAT).
- The server keeps the latest data **in memory** and fans it out. **No DB.**
- If no Pi is connected, vitals + ECG **fall back to simulated data** so the
  site always demos. (Camera/WebRTC have no simulation — they show a placeholder.)

---

## 5. Current status

### ✅ Working / done
- Full vitals + ECG relay with simulation fallback (verified end-to-end).
- **Option A camera** (JPEG-over-WebSocket relay): `/ingest/camera` (Pi) →
  `/ws/camera` (browser), with latest-frame cache. **Confirmed working** —
  backend `/health` showed `camera_live: true`.
- PWA: installable, manifest + service worker + generated icons, iOS/Android
  standalone meta tags, safe-area insets, touch polish, in-app Install button.
- Deploy configs: `render.yaml`, `vercel.json`.
- `config.ts` hardened to strip trailing slashes from `VITE_API_BASE`.

### ⏳ In progress — WebRTC video (Option B), the active task
- **DONE:** `backend/websocket/webrtc_ws.py` — the signaling broker
  (`publisher_endpoint`, `viewer_endpoint`, `SignalHub`). Non-trickle ICE design.
- **NOT done yet** (see §6 for the exact spec):
  1. `GET /webrtc/ice` endpoint in `api/routes.py`.
  2. Register `/webrtc/publisher` + `/webrtc/viewer` WebSockets in `main.py`.
  3. `backend/pi_webrtc.py` — the aiortc publisher (run on the Pi).
  4. `aiortc` added to `requirements-pi.txt`.
  5. Frontend: `useWebRtcCamera` hook + `WebRtcCamera` component + `config.ts`
     URLs; swap `CameraFeed` → `WebRtcCamera` in `Dashboard.tsx`.
  6. Verify (signaling routing test + frontend build) + docs.

### 🐞 Known open issues (fix these)
1. **Trailing slash bug (HIGH).** The deployed Vercel build had
   `VITE_API_BASE = https://rpm-backend-vleu.onrender.com/` (note the `/`),
   producing `//latest-vitals` (404) and `//ws/...` (rejected). The `config.ts`
   fix strips it, **but the frontend must be rebuilt + redeployed**, and the
   Vercel env var should also be corrected to have **no trailing slash**.
   *WebRTC signaling uses the same base URL — it will fail identically until this
   is deployed.*
2. **Uncommitted work.** Many changes (relay, camera, PWA, WebRTC start) are in
   the working tree but **not yet committed/pushed**. Render/Vercel only rebuild
   from GitHub, so commit + push is required to deploy anything.
3. **Pi low-voltage warning** observed — use a proper **5V/3A** supply
   (matters more for aiortc, which is CPU-heavy).

---

## 6. The task: finish WebRTC (Option B) — precise spec

WebRTC media is **peer-to-peer**; the server only relays SDP. We use
**non-trickle ICE** (each peer finishes gathering, so candidates are embedded in
the SDP — no separate candidate messages). The broker already implements this.

### Signaling contract (already enforced by `webrtc_ws.py`)
- Roles: **publisher** = the Pi (`/webrtc/publisher?token=...`); **viewer** =
  the browser (`/webrtc/viewer`). One publisher, N viewers.
- viewer connects → server → publisher: `{type:"viewer-join","viewer":<id>}`
  (or to the viewer `{type:"no-publisher"}` if none).
- publisher → viewer: `{type:"offer","viewer":<id>,"sdp":...}` (server strips `viewer`).
- viewer → publisher: `{type:"answer","sdp":...}` (server adds `viewer:<id>`).
- on disconnect: `{type:"viewer-leave","viewer":<id>}` to publisher, or
  `{type:"publisher-gone"}` to all viewers.

### 6.1 `api/routes.py` — add ICE config
```python
import os
@router.get("/webrtc/ice")
def webrtc_ice() -> dict:
    servers = [{"urls": "stun:stun.l.google.com:19302"}]
    turn = os.environ.get("RPM_TURN_URL")
    if turn:
        servers.append({
            "urls": turn,
            "username": os.environ.get("RPM_TURN_USERNAME", ""),
            "credential": os.environ.get("RPM_TURN_CREDENTIAL", ""),
        })
    return {"iceServers": servers}
```

### 6.2 `main.py` — register the two WebSockets
```python
from websocket.webrtc_ws import publisher_endpoint, viewer_endpoint

@app.websocket("/webrtc/publisher")
async def ws_pub(websocket: WebSocket): await publisher_endpoint(websocket)

@app.websocket("/webrtc/viewer")
async def ws_view(websocket: WebSocket): await viewer_endpoint(websocket)
```
> The static-file catch-all (`/{full_path:path}`, GET only) does **not** affect
> these WebSocket routes. Keep the catch-all registered last.

### 6.3 `backend/pi_webrtc.py` (run on the Pi) — aiortc publisher
- Open camera with `aiortc.contrib.media.MediaPlayer("/dev/video0", format="v4l2",
  options={"video_size":"640x480","framerate":"15"})`; share via `MediaRelay`.
- `GET {RPM_SERVER}/webrtc/ice` → build `RTCConfiguration([RTCIceServer(...)])`.
- Connect WS `{RPM_SERVER→ws}/webrtc/publisher?token=RPM_INGEST_TOKEN`.
- On `viewer-join`: create `RTCPeerConnection(config)`, `addTrack(relay.subscribe(player.video))`,
  `createOffer` → `setLocalDescription` → **await ICE gathering complete** →
  send `{type:"offer","viewer":id,"sdp":pc.localDescription.sdp}`. Keep `pcs[id]=pc`.
- On `answer`: `pcs[id].setRemoteDescription(RTCSessionDescription(sdp, "answer"))`.
- On `viewer-leave`: close + drop `pcs[id]`. Reconnect WS on drop.
- ICE-wait helper:
  ```python
  async def wait_ice(pc):
      if pc.iceGatheringState == "complete": return
      done = asyncio.Event()
      @pc.on("icegatheringstatechange")
      def _():
          if pc.iceGatheringState == "complete": done.set()
      await done.wait()
  ```
- Env: `RPM_SERVER`, `RPM_INGEST_TOKEN`, `RPM_CAMERA_DEVICE` (default `/dev/video0`),
  `RPM_CAMERA_WIDTH/HEIGHT/FPS`.

### 6.4 `requirements-pi.txt` — add
```
aiortc            # WebRTC for the Pi (Option B). Pulls PyAV/ffmpeg — heavy on a Pi.
                  # If install is slow, prefer: sudo apt install -y python3-av ffmpeg
```

### 6.5 Frontend
- `config.ts`: add `webrtcViewerUrl: \`${WS_BASE}/webrtc/viewer\`` and
  `iceConfigUrl: \`${API_BASE}/webrtc/ice\``.
- `hooks/useWebRtcCamera.ts`: returns `{ stream: MediaStream|null, status }`.
  GET ICE config → open `/webrtc/viewer` WS → on `offer`: `new RTCPeerConnection({iceServers})`,
  `setRemoteDescription(offer)`, `createAnswer`, `setLocalDescription`, **await ICE
  complete**, send `{type:"answer","sdp":pc.localDescription.sdp}`; `pc.ontrack` →
  `setStream(ev.streams[0])`, status `online`. Handle `publisher-gone`/`no-publisher`
  → offline; reconnect on close. Clean up pc/ws on unmount.
- `components/WebRtcCamera.tsx`: a `<video ref autoPlay playsInline muted>` with
  `videoRef.current.srcObject = stream` (autoplay on mobile requires `muted` +
  `playsInline`). Reuse the card styling from `CameraFeed.tsx` (Video icon,
  OnlineIndicator, placeholder when no stream).
- `pages/Dashboard.tsx`: replace `<CameraFeed />` with `<WebRtcCamera />`.
  **Keep `CameraFeed.tsx` and the JPEG endpoints** as a working fallback.

### Acceptance criteria
- `npm run build` passes (tsc + vite).
- Backend signaling routing test: connect a fake "publisher" WS and a "viewer"
  WS; assert `viewer-join` reaches the publisher, an `offer` reaches the viewer,
  and the `answer` reaches the publisher tagged with the right `viewer` id.
- On the same LAN (STUN only), the Pi's `pi_webrtc.py` → browser shows live video.
- Remote viewing requires TURN (see §7).

---

## 7. Deployment & secrets

- **Commit + push** to `abrarahnafkarim/ICU-Monitoring` (`main`) → Render & Vercel
  auto-redeploy.
- **Render** (backend): Blueprint reads `render.yaml`. Set env `RPM_INGEST_TOKEN`
  (dashboard, `sync:false`). For WebRTC remote, also set `RPM_TURN_URL`,
  `RPM_TURN_USERNAME`, `RPM_TURN_CREDENTIAL`. **Keep it a single instance** (§8).
- **Vercel** (frontend): `VITE_API_BASE = https://rpm-backend-vleu.onrender.com`
  (**no trailing slash**) → must be set **before build** and a **redeploy** is
  required after changes.
- **Pi:** `RPM_SERVER=https://rpm-backend-vleu.onrender.com`,
  `RPM_INGEST_TOKEN=<same as Render>`. Currently the token in use is `raspberrypi`.
- **TURN for remote WebRTC:** self-host `coturn` on a small VPS (Render free can't
  be a TURN server). Without TURN, WebRTC works on the same Wi-Fi but usually
  fails over cellular/remote.

---

## 8. Invariants — DO NOT BREAK

1. **Single backend instance.** The relay state (vitals, ECG/camera hubs, WebRTC
   `SignalHub`) lives in process memory. Multiple instances would split it. Free
   tier is single-instance — do not add autoscaling without an external store.
2. **Backend needs WebSockets** → cannot run on Vercel. Frontend on Vercel,
   backend on Render (or any WS-capable host).
3. **`VITE_API_BASE` has no trailing slash**; `config.ts` strips it defensively —
   keep that.
4. **Service worker must not cache live API** (`/latest-vitals`, `/ws/*`,
   `/ingest/*`). The Workbox `navigateFallbackDenylist` in `vite.config.ts`
   guards this.
5. **Pi pushes out; never expects inbound.** Keep the producer/consumer split.
6. **Ingest endpoints are token-gated** via `state.check_token` (env
   `RPM_INGEST_TOKEN`; empty = open, for local only). WebRTC publisher reuses it.
7. **Keep Option A (JPEG) as a fallback** when adding Option B.

---

## 9. Run & verify locally

```bash
# Backend
cd telemedicine/backend
python -m venv .venv && . .venv/Scripts/activate    # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000        # http://localhost:8000/health

# Frontend (separate terminal)
cd telemedicine/frontend
npm install
npm run dev                                   # http://localhost:5173  (dev uses localhost:8000)
```
- With no Pi, vitals + ECG are **simulated**; camera shows a placeholder.
- Health check: `GET http://localhost:8000/health` → `ecg_live`, `camera_live` flags.

Hardware bring-up (real sensors + camera): see **`telemedicine/HARDWARE.md`**.
Architecture, API table, deploy: see **`telemedicine/README.md`**.

---

## 10. Suggested order of work for the next agent
1. Commit + push current tree (so the deploys aren't stale).
2. Fix the Vercel `VITE_API_BASE` trailing slash + redeploy → confirm Option A
   video and vitals/ECG light up (this de-risks everything).
3. Implement §6.1–§6.2 (backend) and write the signaling routing test.
4. Implement §6.5 (frontend) and `npm run build`.
5. Implement §6.3–§6.4 (Pi) and test on the LAN (STUN only).
6. Add TURN (coturn) for remote; document.
7. Update `README.md` API table + `HARDWARE.md` with the WebRTC path.
