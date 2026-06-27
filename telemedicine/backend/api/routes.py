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
import time
from typing import Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import state
from sensors import ad8232, max30102, mlx90614, respiration

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
    respiratory_rate: int  # breaths/min, fused from PPG + ECG-derived respiration


class VitalsIngest(BaseModel):
    heart_rate: int
    spo2: int
    temperature: float
    ecg_status: Optional[str] = None
    respiratory_rate: Optional[int] = None


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


class Event(BaseModel):
    id: int
    patient_id: str
    type: str
    severity: str
    title: str
    detail: str
    timestamp: str  # ISO 8601, UTC


_VALID_PATIENT_IDS = {p["patient_id"] for p in PATIENTS}


# --- Demo: temporarily force an abnormal vital so alerts/notifications fire - #
# Maps patient_id -> {"field": str, "value": float, "until": epoch_seconds}.
# Used only to demonstrate the notification system (the normal sim never crosses
# the alert thresholds). Each anomaly auto-expires.
_anomalies: Dict[str, dict] = {}


class AnomalyRequest(BaseModel):
    patient_id: str
    # One of: heart_rate, spo2, temperature, respiratory_rate. Default picks a
    # clearly-abnormal high heart rate.
    field: str = "heart_rate"
    value: Optional[float] = None
    duration_seconds: int = 20


_ANOMALY_DEFAULTS = {
    "heart_rate": 132.0,      # > 120 -> High Heart Rate (danger)
    "spo2": 88.0,             # < 92  -> Low Blood Oxygen (danger)
    "temperature": 39.2,      # > 38.5 -> High Body Temperature (warning)
    "respiratory_rate": 27.0,  # > 24  -> High Respiratory Rate (warning)
}


def _apply_anomaly(patient_id: str, vitals: "Vitals") -> "Vitals":
    """Overlay an active demo anomaly onto a patient's vitals, if any."""
    a = _anomalies.get(patient_id)
    if not a:
        return vitals
    if time.time() > a["until"]:
        _anomalies.pop(patient_id, None)
        return vitals

    data = vitals.model_dump()
    field, value = a["field"], a["value"]
    if field == "temperature":
        data[field] = round(float(value), 1)
    else:
        data[field] = int(round(value))
    data["ecg_status"] = _classify_ecg(data["heart_rate"])
    return Vitals(**data)


def _classify_ecg(heart_rate: int) -> str:
    """Derive a simple ECG status label from the heart rate."""
    if heart_rate > 120:
        return "Tachycardia"
    if heart_rate < 50:
        return "Bradycardia"
    return "Normal"


# --- Server-side alert thresholds -> patient event log -------------------- #
# Single source of truth for "what's an issue", mirrored on the frontend
# (lib/alerts.ts). Each rule: (id, severity, title, predicate, detail builder).
def _alert_rules(v: "Vitals"):
    return [
        ("hr-high", "danger", "High Heart Rate",
         v.heart_rate > 120, f"Heart rate {v.heart_rate} BPM is above 120 BPM."),
        ("hr-low", "danger", "Low Heart Rate",
         v.heart_rate < 50, f"Heart rate {v.heart_rate} BPM is below 50 BPM."),
        ("spo2-low", "danger", "Low Blood Oxygen",
         v.spo2 < 92, f"SpO2 {v.spo2}% is below 92%."),
        ("temp-high", "warning", "High Body Temperature",
         v.temperature > 38.5, f"Temperature {v.temperature:.1f}°C is above 38.5°C."),
        ("rr-high", "warning", "High Respiratory Rate",
         v.respiratory_rate > 24, f"Respiratory rate {v.respiratory_rate} br/min is above 24."),
        ("rr-low", "warning", "Low Respiratory Rate",
         v.respiratory_rate < 8, f"Respiratory rate {v.respiratory_rate} br/min is below 8."),
    ]


# Tracks currently-active alert ids per patient so each episode logs once.
_active_alerts: Dict[str, set] = {}


def _log_threshold_events(patient_id: str, vitals: "Vitals") -> None:
    """Detect alert onsets and append them to the patient's event log."""
    active_now = set()
    prev = _active_alerts.get(patient_id, set())
    for rule_id, severity, title, fired, detail in _alert_rules(vitals):
        if fired:
            active_now.add(rule_id)
            if rule_id not in prev:  # onset only
                state.add_event(patient_id, rule_id, severity, title, detail)
    _active_alerts[patient_id] = active_now


# --- Patient 2: independent simulation ------------------------------------ #
# There is only one Pi, so Patient 2 never uses real hardware data. It runs its
# own random-walk simulation with baselines just slightly offset from Patient 1,
# so the two dashboards differ by only a small, realistic amount.
_P2 = {"hr": 78.0, "spo2": 97.0, "temp": 36.9, "rr_ppg": 15.0, "rr_edr": 15.0}


def _simulate_patient2() -> "Vitals":
    """Generate independent simulated vitals for Patient 2."""
    _P2["hr"] += random.gauss(0.0, 0.6) + (78.0 - _P2["hr"]) * 0.08
    _P2["hr"] = max(70.0, min(80.0, _P2["hr"]))

    _P2["spo2"] += random.gauss(0.0, 0.2) + (97.0 - _P2["spo2"]) * 0.1
    _P2["spo2"] = max(96.0, min(99.0, _P2["spo2"]))

    _P2["temp"] += random.gauss(0.0, 0.03) + (36.9 - _P2["temp"]) * 0.06
    _P2["temp"] = max(36.6, min(37.2, _P2["temp"]))

    # Two independent respiratory estimates fused through the real algorithm.
    _P2["rr_ppg"] += random.gauss(0.0, 0.4) + (15.0 - _P2["rr_ppg"]) * 0.06
    _P2["rr_edr"] += random.gauss(0.0, 0.4) + (15.0 - _P2["rr_edr"]) * 0.06
    rr_fused, _q, _src = respiration.fuse_respiratory_rate(
        _P2["rr_ppg"], 0.84, _P2["rr_edr"], 0.86
    )
    respiratory_rate = int(round(rr_fused if rr_fused is not None else 15.0))

    heart_rate = int(round(_P2["hr"]))
    return Vitals(
        heart_rate=heart_rate,
        spo2=int(round(_P2["spo2"])),
        temperature=round(_P2["temp"], 1),
        ecg_status=_classify_ecg(heart_rate),
        respiratory_rate=respiratory_rate,
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
    patient_id = patient or "P-001"

    if patient == "P-002":
        base = _simulate_patient2()
    else:
        pushed = state.get_fresh_vitals()
        if pushed is not None:
            base = Vitals(**pushed)
        else:
            heart_rate = max30102.read_heart_rate()
            spo2 = max30102.read_spo2()
            temperature = mlx90614.read_temperature()
            respiratory_rate = respiration.read_respiratory_rate()
            ad8232.set_heart_rate(heart_rate)
            base = Vitals(
                heart_rate=heart_rate,
                spo2=spo2,
                temperature=temperature,
                ecg_status=_classify_ecg(heart_rate),
                respiratory_rate=respiratory_rate,
            )

    final = _apply_anomaly(patient_id, base)
    _log_threshold_events(patient_id, final)
    return final


@router.post("/ingest/vitals")
def ingest_vitals(
    payload: VitalsIngest,
    x_ingest_token: Optional[str] = Header(default=None),
) -> dict:
    """Receive a vitals reading pushed by the Raspberry Pi."""
    if not state.check_token(x_ingest_token):
        raise HTTPException(status_code=401, detail="Invalid ingest token")

    ecg_status = payload.ecg_status or _classify_ecg(payload.heart_rate)
    # The Pi may compute the fused respiratory rate itself; if it doesn't send
    # one, fall back to the local fused-simulation so the field is always set.
    respiratory_rate = (
        payload.respiratory_rate
        if payload.respiratory_rate is not None
        else respiration.read_respiratory_rate()
    )
    state.update_vitals(
        {
            "heart_rate": payload.heart_rate,
            "spo2": payload.spo2,
            "temperature": payload.temperature,
            "ecg_status": ecg_status,
            "respiratory_rate": respiratory_rate,
        }
    )
    # Keep the simulated-ECG rhythm aligned in case we briefly fall back.
    ad8232.set_heart_rate(payload.heart_rate)
    return {"ok": True}


# --- Patient event log ---------------------------------------------------- #
@router.get("/events", response_model=List[Event])
def get_events(patient: str) -> List[Event]:
    """Return a patient's clinical event log (alert onsets), newest first."""
    if patient not in _VALID_PATIENT_IDS:
        raise HTTPException(status_code=404, detail="Unknown patient")
    return [Event(**e) for e in state.get_events(patient)]


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


# --- Demo: trigger a patient anomaly (to exercise notifications) ----------- #
@router.post("/simulate-anomaly")
def simulate_anomaly(payload: AnomalyRequest) -> dict:
    """
    Temporarily force an abnormal vital so the alert/notification system fires.

    For demos only — the normal simulation never crosses the alert thresholds.
    The anomaly auto-expires after ``duration_seconds``.
    """
    if payload.patient_id not in _VALID_PATIENT_IDS:
        raise HTTPException(status_code=404, detail="Unknown patient")
    if payload.field not in _ANOMALY_DEFAULTS:
        raise HTTPException(
            status_code=422,
            detail=f"field must be one of {sorted(_ANOMALY_DEFAULTS)}",
        )

    value = payload.value
    if value is None:
        value = _ANOMALY_DEFAULTS[payload.field]
    duration = max(5, min(120, payload.duration_seconds))

    _anomalies[payload.patient_id] = {
        "field": payload.field,
        "value": float(value),
        "until": time.time() + duration,
    }
    return {
        "ok": True,
        "patient_id": payload.patient_id,
        "field": payload.field,
        "value": value,
        "expires_in": duration,
    }
