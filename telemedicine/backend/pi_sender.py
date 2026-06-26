"""
Raspberry Pi sender — RUN THIS ON THE PI.

The Pi does not host anything. It just reads the sensors and PUSHES the data
up to the hosted dashboard:

  * vital numbers  -> HTTP POST  {SERVER}/ingest/vitals      (every 2 s)
  * ECG waveform   -> WebSocket  {SERVER}/ingest/ecg         (continuous)

It reuses the same sensor modules in ``sensors/`` — so once you replace those
with real hardware reads (see HARDWARE.md), this script pushes real data with
no changes.

Configure with environment variables:
    RPM_SERVER        the hosted app URL, e.g. https://your-app.example.com
    RPM_INGEST_TOKEN  shared secret that matches the server (recommended)

Run:
    # Linux / Pi
    RPM_SERVER=https://your-app.example.com RPM_INGEST_TOKEN=secret python pi_sender.py
"""

from __future__ import annotations

import asyncio
import json
import os
import urllib.request

import websockets

from sensors import ad8232, max30102, mlx90614, respiration

SERVER = os.environ.get("RPM_SERVER", "http://localhost:8000").rstrip("/")
TOKEN = os.environ.get("RPM_INGEST_TOKEN", "")

# Derive the ws:// (or wss://) ingest URL from the http(s) server URL.
WS_URL = SERVER.replace("http", "ws", 1) + "/ingest/ecg"
if TOKEN:
    WS_URL += f"?token={TOKEN}"

SAMPLE_RATE = ad8232.SAMPLE_RATE
BATCH_SIZE = 10
BATCH_INTERVAL = BATCH_SIZE / SAMPLE_RATE  # seconds
VITALS_INTERVAL = 2.0  # seconds


def _classify_ecg(heart_rate: int) -> str:
    if heart_rate > 120:
        return "Tachycardia"
    if heart_rate < 50:
        return "Bradycardia"
    return "Normal"


def _post_vitals() -> None:
    """Read the vital sensors and POST one reading (blocking; run in executor)."""
    heart_rate = max30102.read_heart_rate()
    spo2 = max30102.read_spo2()
    temperature = mlx90614.read_temperature()
    respiratory_rate = respiration.read_respiratory_rate()
    ad8232.set_heart_rate(heart_rate)

    body = json.dumps(
        {
            "heart_rate": heart_rate,
            "spo2": spo2,
            "temperature": temperature,
            "ecg_status": _classify_ecg(heart_rate),
            "respiratory_rate": respiratory_rate,
        }
    ).encode()

    request = urllib.request.Request(
        f"{SERVER}/ingest/vitals",
        data=body,
        headers={"Content-Type": "application/json", "X-Ingest-Token": TOKEN},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        response.read()


async def vitals_loop() -> None:
    """Push a vitals reading every few seconds."""
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _post_vitals)
        except Exception as exc:  # network hiccup — keep going
            print(f"[vitals] push failed: {exc}")
        await asyncio.sleep(VITALS_INTERVAL)


async def ecg_loop() -> None:
    """Stream ECG sample batches over a WebSocket, reconnecting if dropped."""
    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                print(f"[ecg] streaming to {WS_URL}")
                while True:
                    values = [ad8232.read_ecg_sample() for _ in range(BATCH_SIZE)]
                    await ws.send(json.dumps({"values": values}))
                    await asyncio.sleep(BATCH_INTERVAL)
        except Exception as exc:
            print(f"[ecg] connection lost ({exc}); retrying in 2 s")
            await asyncio.sleep(2)


async def main() -> None:
    print(f"Pushing sensor data to {SERVER}")
    await asyncio.gather(vitals_loop(), ecg_loop())


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped.")
