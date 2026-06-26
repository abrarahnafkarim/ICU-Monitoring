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

import random
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


class Comment(BaseModel):
    id: int
    patient_id: str
    author: str
    text: str
    timestamp: str  # ISO 8601, UTC


class CommentCreate(BaseModel):
    patient_id: str
    text: str
    author: Optional[str] = None


_VALID_PATIENT_IDS = {p["patient_id"] for p in PATIENTS}


def _classify_ecg(heart_rate: int) -> str:
    """Derive a simple ECG status label from the heart rate."""
    if heart_rate > 120:
        return "Tachycardia"
    if heart_rate < 50:
        return "Bradycardia"
    return "Normal"


# --- Patient 2: independent simulation ------------------------------------ #
# There is only one Pi, so Patient 2 never uses real hardware data. It runs its
# own random-walk simulation with baselines just slightly offset from Patient 1,
# so the two dashboards differ by only a small, realistic amount.
_P2 = {"hr": 78.0, "spo2": 97.0, "temp": 36.9}


def _simulate_patient2() -> "Vitals":
    """Generate independent simulated vitals for Patient 2."""
    _P2["hr"] += random.gauss(0.0, 0.6) + (78.0 - _P2["hr"]) * 0.08
    _P2["hr"] = max(70.0, min(80.0, _P2["hr"]))

    _P2["spo2"] += random.gauss(0.0, 0.2) + (97.0 - _P2["spo2"]) * 0.1
    _P2["spo2"] = max(96.0, min(99.0, _P2["spo2"]))

    _P2["temp"] += random.gauss(0.0, 0.03) + (36.9 - _P2["temp"]) * 0.06
    _P2["temp"] = max(36.6, min(37.2, _P2["temp"]))

    heart_rate = int(round(_P2["hr"]))
    return Vitals(
        heart_rate=heart_rate,
        spo2=int(round(_P2["spo2"])),
        temperature=round(_P2["temp"], 1),
        ecg_status=_classify_ecg(heart_rate),
    )


@router.get("/patient", response_model=Patient)
def get_patient() -> Patient:
    """Return the first demo patient's profile (back-compatible)."""
    return Patient(**PATIENT)


@router.get("/patients", response_model=List[Patient])
def get_patients() -> List[Patient]:
    """Return all demo patient profiles."""
    return [Patient(**p) for p in PATIENTS]


@router.get("/latest-vitals", response_model=Vitals)
def get_latest_vitals(patient: Optional[str] = None) -> Vitals:
    """
    Return the latest vitals for a patient.

    Patient 2 (``?patient=P-002``) always returns its own independent
    simulation. Patient 1 (the default) prefers the most recent reading pushed
    by the Pi; if none has arrived (or it is stale), it falls back to locally
    simulated values so the dashboard still works for a demo.
    """
    if patient == "P-002":
        return _simulate_patient2()

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


# --- Doctor comments ------------------------------------------------------ #
@router.get("/comments", response_model=List[Comment])
def get_comments(patient: str) -> List[Comment]:
    """Return a patient's doctor comments, newest first."""
    if patient not in _VALID_PATIENT_IDS:
        raise HTTPException(status_code=404, detail="Unknown patient")
    return [Comment(**c) for c in state.get_comments(patient)]


@router.post("/comments", response_model=Comment)
def post_comment(payload: CommentCreate) -> Comment:
    """Add a doctor comment to a patient. Shared with every viewer."""
    if payload.patient_id not in _VALID_PATIENT_IDS:
        raise HTTPException(status_code=404, detail="Unknown patient")

    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Comment text is empty")
    if len(text) > 1000:
        text = text[:1000]

    author = (payload.author or "Doctor").strip() or "Doctor"
    created = state.add_comment(payload.patient_id, text, author)
    return Comment(**created)
