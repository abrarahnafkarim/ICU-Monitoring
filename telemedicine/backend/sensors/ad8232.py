"""
AD8232 single-lead ECG sensor interface.

SIMULATION MODE (default):
    Produces a realistic streaming ECG waveform using ``ECGSimulator``.

RASPBERRY PI MODE (future):
    Replace the body of ``read_ecg_sample`` with a real ADC read of the
    AD8232 OUTPUT pin, e.g. via an MCP3008 / ADS1115:

        from your_adc_driver import read_voltage
        def read_ecg_sample() -> float:
            return read_voltage(channel=0)

    The rest of the application (WebSocket + frontend) stays unchanged.
"""

from __future__ import annotations

from .ecg_simulator import ECGSimulator

# Sample rate the ECG is generated / streamed at.
SAMPLE_RATE = 250

_simulator = ECGSimulator(sample_rate=SAMPLE_RATE, heart_rate=76.0)


def read_ecg_sample() -> float:
    """Return a single ECG amplitude sample (mV-like units)."""
    return _simulator.next_sample()


def set_heart_rate(heart_rate: float) -> None:
    """Keep the ECG rhythm in sync with the reported heart rate."""
    _simulator.set_heart_rate(heart_rate)


def is_connected() -> bool:
    """Report sensor health. Always True in simulation mode."""
    return True
