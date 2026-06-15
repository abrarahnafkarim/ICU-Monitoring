"""
REST API routes for the Remote Patient Monitoring demo.

Endpoints
---------
GET  /patient        -> first demo patient profile (back-compat)
GET  /patients       -> all demo patient profiles
GET  /latest-vitals  -> latest vitals (pushed by the Pi, else simulated)
POST /ingest/vitals  -> the Raspberry Pi pushes a vitals reading here
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import state
from sensors import ad8232, max30102, mlx90614

router = APIRouter()

# --- Demo patients -------------------------------------------------------- #
# Both patients are fed by the same live data source (one Pi). They differ
# only in their profile; the dashboard shows the same vitals/ECG/camera.
PATIENTS = [
    {
        "name": "Patient 1",
        "patient_id": "P-001",
        "age": 22,
        "gender": "Male",
        "status": "Monitoring Active",
    },
    {
        "name": "Patient 2",
        "patient_id": "P-002",
        "age": 22,
        "gender": "Male",
        "status": "Monitoring Active",
    },
]

# First patient kept for the back-compatible single-patient endpoint.
PATIENT = PATIENTS[0]


# --- Models --------------------------------------------------------------- #
class Patient(BaseModel):
    name: str
    patient_id: str
    age: int
    gender: str
    status: str


class Vitals(BaseModel):
    heart_rate: int
    spo2: int
    temperature: float
    ecg_status: str


class VitalsIngest(BaseModel):
    heart_rate: int
    spo2: int
    temperature: float
    ecg_status: Optional[str] = None


def _classify_ecg(heart_rate: int) -> str:
    """Derive a simple ECG status label from the heart rate."""
    if heart_rate > 120:
        return "Tachycardia"
    if heart_rate < 50:
        return "Bradycardia"
    return "Normal"


@router.get("/patient", response_model=Patient)
def get_patient() -> Patient:
    """Return the first demo patient's profile (back-compatible)."""
    return Patient(**PATIENT)


@router.get("/patients", response_model=List[Patient])
def get_patients() -> List[Patient]:
    """Return all demo patient profiles."""
    return [Patient(**p) for p in PATIENTS]


@router.get("/latest-vitals", response_model=Vitals)
def get_latest_vitals() -> Vitals:
    """
    Return the latest vitals.

    Prefers the most recent reading pushed by the Pi; if none has arrived
    (or it is stale), falls back to locally simulated values so the dashboard
    still works for a demo.
    """
    pushed = state.get_fresh_vitals()
    if pushed is not None:
        return Vitals(**pushed)

    heart_rate = max30102.read_heart_rate()
    spo2 = max30102.read_spo2()
    temperature = mlx90614.read_temperature()
    ad8232.set_heart_rate(heart_rate)

    return Vitals(
        heart_rate=heart_rate,
        spo2=spo2,
        temperature=temperature,
        ecg_status=_classify_ecg(heart_rate),
    )


@router.post("/ingest/vitals")
def ingest_vitals(
    payload: VitalsIngest,
    x_ingest_token: Optional[str] = Header(default=None),
) -> dict:
    """Receive a vitals reading pushed by the Raspberry Pi."""
    if not state.check_token(x_ingest_token):
        raise HTTPException(status_code=401, detail="Invalid ingest token")

    ecg_status = payload.ecg_status or _classify_ecg(payload.heart_rate)
    state.update_vitals(
        {
            "heart_rate": payload.heart_rate,
            "spo2": payload.spo2,
            "temperature": payload.temperature,
            "ecg_status": ecg_status,
        }
    )
    # Keep the simulated-ECG rhythm aligned in case we briefly fall back.
    ad8232.set_heart_rate(payload.heart_rate)
    return {"ok": True}
