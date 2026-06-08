# Remote Patient Monitoring System

A telemedicine remote patient-monitoring **demo** built for a university
engineering project. It shows a single demo patient (**Abrar Ahnaf**) on a
clean, medical-grade dashboard with **live vitals** and a **real-time
scrolling ECG** streamed over WebSockets.

The sensor layer is fully simulated but structured so the simulated data
sources can be swapped for real **Raspberry Pi** hardware drivers
(AD8232, MAX30102, MLX90614) without touching the API, WebSocket, or UI.

---

## ✨ Features

- 🔐 **Login page** — hardcoded demo credentials (`admin` / `admin123`), no backend auth.
- 🩺 **Patient overview** — single clickable patient card with live mini-vitals.
- 📊 **Patient dashboard**
  - Patient profile card (name, ID, age, gender, status).
  - Four live metric cards: Heart Rate, SpO₂, Body Temperature, ECG Status.
  - **Live ECG** — real-time, scrolling, medical-monitor-style Plotly chart (last 10 s).
  - **Live camera** — webcam video feed (JPEG frames relayed from the Pi).
  - Sensor status panel (AD8232 / MAX30102 / MLX90614).
  - Alert panel with clinical threshold rules.
- 🎨 Premium dark-mode healthcare-SaaS theme, glassmorphism, fully responsive
  (desktop / tablet / mobile).

---

## 🧰 Tech Stack

| Layer        | Technology                                            |
| ------------ | ----------------------------------------------------- |
| Frontend     | React + TypeScript + Vite + TailwindCSS + React Router |
| Charting     | Plotly.js (`plotly.js-dist-min`, WebGL trace)         |
| Backend      | FastAPI + Python 3.11+                                 |
| Live data    | WebSocket (`/ws/ecg`)                                  |

---

## 📁 Project Structure

```
telemedicine/
├── backend/                    # the HOSTED app (serves site + receives Pi data)
│   ├── main.py                 # FastAPI app + routes/WS + serves built frontend
│   ├── state.py                # in-memory store for the latest pushed vitals
│   ├── pi_sender.py            # RUN ON THE PI: pushes vitals + ECG up to the app
│   ├── pi_camera.py            # RUN ON THE PI: pushes webcam frames up to the app
│   ├── requirements.txt        # server deps
│   ├── requirements-pi.txt     # Pi deps (sender + camera + hardware drivers)
│   ├── api/
│   │   └── routes.py           # GET /patient, /latest-vitals; POST /ingest/vitals
│   ├── websocket/
│   │   ├── ecg_ws.py           # ECG hub: /ws/ecg (browser) + /ingest/ecg (Pi)
│   │   └── camera_ws.py        # camera hub: /ws/camera + /ingest/camera
│   └── sensors/
│       ├── ecg_simulator.py    # realistic P-QRS-T waveform generator
│       ├── ad8232.py           # ECG sensor interface (read_ecg_sample)
│       ├── max30102.py         # HR + SpO2 interface
│       └── mlx90614.py         # body-temperature interface
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── main.tsx            # app bootstrap (router + auth)
        ├── App.tsx             # routes + auth guard
        ├── config.ts           # API/WS URLs, demo credentials
        ├── types/              # shared TypeScript interfaces
        ├── api/client.ts       # typed fetch wrapper
        ├── auth/AuthContext.tsx
        ├── hooks/              # useVitals, useEcgStream, usePatient, useClock
        ├── lib/alerts.ts       # alert threshold rules
        ├── components/         # Navbar, MetricCard, EcgChart, panels, ui/
        └── pages/              # Login, PatientList, Dashboard
```

---

## 🌐 How live data flows (Pi → website)

The Raspberry Pi does **not** host anything — it can't be reached from the
internet behind home WiFi. Instead it **pushes** readings up to the hosted app,
which serves the dashboard and relays the data to browsers:

```text
 ┌──────────────┐   POST /ingest/vitals    ┌──────────────────┐   GET /latest-vitals  ┌──────────┐
 │ Raspberry Pi │ ───────────────────────► │   Hosted FastAPI  │ ────────────────────► │ Browser  │
 │ (pi_sender   │   WS   /ingest/ecg        │  app (your domain)│   WS   /ws/ecg        │ dashboard│
 │  pi_camera)  │   WS   /ingest/camera     │                  │   WS   /ws/camera     │          │
 └──────────────┘ ───────────────────────► └──────────────────┘ ────────────────────► └──────────┘
   reads sensors                              keeps latest +                            shows live
   + webcam                                   serves the website                  vitals + ECG + video
```

- **No Pi connected?** The hosted app falls back to **simulated** data, so the
  site always shows a live demo.
- **Pi connected?** Real data automatically takes over within ~1–2 seconds.

There are three ways to run it:

| Mode | What runs where | Use it for |
| --- | --- | --- |
| **Local demo** | backend + Vite dev server on your laptop | development (simulated data) |
| **Hosted app** | one FastAPI app on your server/domain | the public website |
| **Pi sender** | `pi_sender.py` on the Raspberry Pi | pushing real sensor data up |

---

## 🚀 Installation & Run (local demo)

> Requires **Python 3.11+** and **Node.js 18+**. Use **two terminals**.

### 1) Backend (FastAPI)

```bash
cd telemedicine/backend

# create + activate a virtual environment
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt

# run the API + WebSocket server on http://localhost:8000
uvicorn main:app --reload --port 8000
```

Verify: open <http://localhost:8000/health> → should return a JSON status payload.

### 2) Frontend (React + Vite)

```bash
cd telemedicine/frontend

npm install
npm run dev
```

Open the app at <http://localhost:5173>.

**Login:** `admin` / `admin123` → Patient overview → click the patient card → dashboard.

> The frontend talks to `http://localhost:8000` by default. To point it
> elsewhere, set `VITE_API_BASE` (e.g. `VITE_API_BASE=http://192.168.0.50:8000 npm run dev`).

---

## 🚀 Going live (hosted app + Pi sender)

### A) Host the app (serves the website **and** receives the Pi's data)

```bash
# 1. Build the dashboard once (on any machine with Node):
cd telemedicine/frontend
npm install && npm run build          # outputs frontend/dist/

# 2. Put the built site next to the backend so FastAPI serves it:
#    copy frontend/dist  ->  backend/static
#    (or leave it in frontend/dist; the server auto-detects both)

# 3. On your server/domain, run the one app:
cd telemedicine/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export RPM_INGEST_TOKEN="choose-a-secret"   # so only your Pi can push data
uvicorn main:app --host 0.0.0.0 --port 8000
```

Now the dashboard is live at your domain, and `/ingest/*` is ready for the Pi.
The frontend, when served by FastAPI, automatically calls the **same origin** —
no rebuild needed per domain. (Use a reverse proxy / HTTPS in production; make
sure it allows **WebSocket** upgrades for `/ws/ecg` and `/ingest/ecg`.)

### B) Run the sender on the Raspberry Pi

Copy `backend/sensors/`, `backend/pi_sender.py`, and `requirements-pi.txt` to the
Pi, then:

```bash
pip install -r requirements-pi.txt
export RPM_SERVER="https://your-app.example.com"
export RPM_INGEST_TOKEN="choose-a-secret"     # must match the server

python pi_sender.py     # vitals + ECG
python pi_camera.py     # webcam feed (optional, run in a second terminal)
```

The Pi starts pushing vitals (HTTP) + ECG (WebSocket) and the live dashboard
switches from simulated to real data automatically. `pi_camera.py` adds the
webcam feed (defaults to 640×480 @ ~10 fps to stay light on free hosts).
Wiring + real sensor code: **[HARDWARE.md](HARDWARE.md)**.

---

## 🔌 API Reference

| Method | Path             | Description                                      |
| ------ | ---------------- | ------------------------------------------------ |
| GET    | `/`              | Dashboard website (or JSON info if not built)    |
| GET    | `/health`        | Service health / info                            |
| GET    | `/patient`       | Demo patient profile                             |
| GET    | `/latest-vitals` | `heart_rate`, `spo2`, `temperature`, `ecg_status`|
| POST   | `/ingest/vitals` | **Pi → server**: push a vitals reading (JSON)    |
| WS     | `/ws/ecg`        | **Server → browser**: streams ECG sample batches |
| WS     | `/ingest/ecg`    | **Pi → server**: push ECG sample batches         |
| WS     | `/ws/camera`     | **Server → browser**: streams JPEG webcam frames |
| WS     | `/ingest/camera` | **Pi → server**: push JPEG webcam frames         |

**ECG WebSocket message shape**

```json
{
  "sample_rate": 250,
  "samples": [ { "t": 12.34, "v": 0.81 }, ... ]
}
```

`t` = running time in seconds (drives the scrolling x-axis), `v` = amplitude.
Samples are streamed in batches of 10 every 40 ms (≈ 250 Hz).

The Pi pushes ECG to `/ingest/ecg` with a simpler shape (the server adds the
timestamps): `{ "values": [0.81, 0.79, ...] }`. Both ingest endpoints accept an
`RPM_INGEST_TOKEN` (HTTP header `X-Ingest-Token`, or `?token=` on the WebSocket).

---

## 🚨 Alert Rules

Evaluated on the frontend (`src/lib/alerts.ts`) against the latest vitals:

| Condition          | Severity |
| ------------------ | -------- |
| Heart Rate > 120   | danger   |
| Heart Rate < 50    | danger   |
| SpO₂ < 92          | danger   |
| Temperature > 38.5 | warning  |

When none trigger, the panel shows **No Active Alerts**.

---

## 🍓 Raspberry Pi Hardware Integration

> **Full step-by-step wiring + drop-in code: [HARDWARE.md](HARDWARE.md).**

The backend already isolates the hardware behind clean functions. To go live,
edit only the three sensor modules — nothing else changes.

| File                    | Function(s) to implement                         | Hardware                         |
| ----------------------- | ------------------------------------------------ | -------------------------------- |
| `sensors/ad8232.py`     | `read_ecg_sample() -> float`                     | AD8232 ECG (analog → ADC)        |
| `sensors/max30102.py`   | `read_heart_rate() -> int`, `read_spo2() -> int` | MAX30102 pulse oximeter (I²C)    |
| `sensors/mlx90614.py`   | `read_temperature() -> float`                    | MLX90614 IR thermometer (I²C)    |

Example — replacing the simulated ECG with a real ADC read:

```python
# sensors/ad8232.py
from your_adc_driver import read_voltage   # e.g. MCP3008 / ADS1115

def read_ecg_sample() -> float:
    return read_voltage(channel=0)
```

The WebSocket handler (`websocket/ecg_ws.py`) and REST routes
(`api/routes.py`) call these functions, so the streaming pipeline and the
entire frontend keep working unchanged.

---

## 📝 Notes

This is intentionally a **single-patient demo**: no database, no registration,
no multi-user accounts, no cloud deployment. The focus is a realistic,
professional dashboard and a clean architecture ready for real sensors.