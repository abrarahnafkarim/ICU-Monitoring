"""
MAX30102 pulse-oximeter sensor interface (heart rate + SpO2).

SIMULATION MODE (default):
    Returns values that gently fluctuate around healthy baselines so the
    dashboard feels "live".

RASPBERRY PI MODE (future):
    Replace the bodies below with reads from a MAX30102 I2C driver, e.g.:

        import max30102_driver
        def read_heart_rate() -> int:
            return max30102_driver.get_heart_rate()
        def read_spo2() -> int:
            return max30102_driver.get_spo2()
"""

from __future__ import annotations

import random

_HR_BASELINE = 76.0
_SPO2_BASELINE = 98.0

_hr = _HR_BASELINE
_spo2 = _SPO2_BASELINE


def read_heart_rate() -> int:
    """Return the current heart rate in beats per minute (BPM)."""
    global _hr
    # Random walk that drifts back toward the baseline.
    _hr += random.gauss(0.0, 0.6) + (_HR_BASELINE - _hr) * 0.08
    _hr = max(70.0, min(80.0, _hr))
    return int(round(_hr))


def read_spo2() -> int:
    """Return blood-oxygen saturation as a whole-number percentage."""
    global _spo2
    _spo2 += random.gauss(0.0, 0.25) + (_SPO2_BASELINE - _spo2) * 0.1
    _spo2 = max(95.0, min(100.0, _spo2))
    return int(round(_spo2))


def is_connected() -> bool:
    """Report sensor health. Always True in simulation mode."""
    return True
