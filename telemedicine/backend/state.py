"""
In-memory store for the latest data pushed in by the Raspberry Pi.

The hosted app keeps only the most recent reading — no database. If the Pi
hasn't pushed anything recently (or hasn't connected yet), callers fall back to
simulated values so the dashboard still shows something during a demo.
"""

from __future__ import annotations

import itertools
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional

# Seconds after which an ingested vitals reading is considered stale.
VITALS_TTL = 6.0

_latest_vitals: Optional[dict] = None
_latest_vitals_ts: float = 0.0

# --- Doctor comments (in-memory, per patient) ----------------------------- #
# Shared across all viewers so a comment posted from one place is visible
# everywhere. No database: these reset when the server restarts (fine for the
# demo). Keep the most recent MAX_COMMENTS per patient.
MAX_COMMENTS = 200
_comments: Dict[str, List[dict]] = {}
_comment_ids = itertools.count(1)


def add_comment(patient_id: str, text: str, author: str = "Doctor") -> dict:
    """Store a doctor comment for a patient and return the created record."""
    comment = {
        "id": next(_comment_ids),
        "patient_id": patient_id,
        "author": author,
        "text": text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    thread = _comments.setdefault(patient_id, [])
    thread.append(comment)
    # Trim oldest if the thread grows too large.
    if len(thread) > MAX_COMMENTS:
        del thread[: len(thread) - MAX_COMMENTS]
    return comment


def get_comments(patient_id: str) -> List[dict]:
    """Return a patient's comments, newest first."""
    return list(reversed(_comments.get(patient_id, [])))


# --- Patient event log (in-memory, per patient) --------------------------- #
# A running log of clinical events (alert onsets) for the per-patient history /
# log-overview page. Like comments: shared across viewers, no database, resets
# on restart. Newest kept; oldest trimmed past MAX_EVENTS.
MAX_EVENTS = 300
_events: Dict[str, List[dict]] = {}
_event_ids = itertools.count(1)


def add_event(
    patient_id: str,
    event_type: str,
    severity: str,
    title: str,
    detail: str,
) -> dict:
    """Append a clinical event to a patient's log and return the record."""
    event = {
        "id": next(_event_ids),
        "patient_id": patient_id,
        "type": event_type,
        "severity": severity,
        "title": title,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    log = _events.setdefault(patient_id, [])
    log.append(event)
    if len(log) > MAX_EVENTS:
        del log[: len(log) - MAX_EVENTS]
    return event


def get_events(patient_id: str) -> List[dict]:
    """Return a patient's event log, newest first."""
    return list(reversed(_events.get(patient_id, [])))


def update_vitals(vitals: dict) -> None:
    """Store the most recent vitals pushed by the Pi."""
    global _latest_vitals, _latest_vitals_ts
    _latest_vitals = vitals
    _latest_vitals_ts = time.time()


def get_fresh_vitals() -> Optional[dict]:
    """Return the last pushed vitals, or None if missing/stale."""
    if _latest_vitals is None:
        return None
    if time.time() - _latest_vitals_ts > VITALS_TTL:
        return None
    return _latest_vitals


def check_token(provided: Optional[str]) -> bool:
    """
    Validate the shared ingest secret presented by the Pi.

    The expected value comes from the ``RPM_INGEST_TOKEN`` environment variable
    on the server. If it is unset/empty, the check is disabled (open) — fine for
    local testing, but set it in production so only your Pi can push data.
    """
    expected = os.environ.get("RPM_INGEST_TOKEN", "")
    if not expected:
        return True
    return provided == expected
