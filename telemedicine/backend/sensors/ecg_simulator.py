"""
Realistic ECG waveform simulator.

Generates a continuous, physiologically-shaped ECG signal (P, Q, R, S, T
complex) sample-by-sample so it can be streamed in real time over a
WebSocket. The waveform is built from a sum of Gaussian "bumps", one per
deflection of a normal sinus rhythm, plus light baseline wander and noise
to look like a real bedside monitor trace.

This module knows nothing about FastAPI or hardware — it is pure signal
generation and is consumed by ``sensors/ad8232.py``.
"""

from __future__ import annotations

import math
import random


def _gaussian(x: float, center: float, width: float, amplitude: float) -> float:
    """A single Gaussian deflection used to model one ECG wave."""
    return amplitude * math.exp(-((x - center) ** 2) / (2.0 * width ** 2))


def ecg_waveform(phase: float) -> float:
    """
    Return the ECG amplitude (in mV-like units) for a given cardiac-cycle
    phase in the range [0, 1).

    The phase positions below are tuned to produce a recognisable
    P -> QRS -> T morphology.
    """
    value = 0.0
    value += _gaussian(phase, 0.18, 0.028, 0.12)   # P wave
    value += _gaussian(phase, 0.295, 0.0090, -0.14)  # Q
    value += _gaussian(phase, 0.330, 0.0095, 1.05)   # R (tall spike)
    value += _gaussian(phase, 0.365, 0.0095, -0.28)  # S
    value += _gaussian(phase, 0.560, 0.050, 0.32)    # T wave
    return value


class ECGSimulator:
    """
    Stateful ECG generator. Call :meth:`next_sample` at a fixed sample rate
    (e.g. 250 Hz) to obtain a continuous waveform.
    """

    def __init__(self, sample_rate: int = 250, heart_rate: float = 76.0) -> None:
        self.sample_rate = sample_rate
        self.heart_rate = heart_rate
        self._phase = 0.0          # position within the current beat [0, 1)
        self._elapsed = 0.0        # seconds since start (for baseline wander)

    def set_heart_rate(self, heart_rate: float) -> None:
        """Allow the heart rate to drift over time for a more lively trace."""
        self.heart_rate = max(30.0, min(200.0, heart_rate))

    def next_sample(self) -> float:
        """Advance the simulation by one sample and return the amplitude."""
        beats_per_second = self.heart_rate / 60.0
        self._phase += beats_per_second / self.sample_rate
        if self._phase >= 1.0:
            self._phase -= 1.0

        amplitude = ecg_waveform(self._phase)
        amplitude += 0.025 * math.sin(2.0 * math.pi * 0.25 * self._elapsed)  # baseline wander
        amplitude += random.gauss(0.0, 0.012)                                # sensor noise

        self._elapsed += 1.0 / self.sample_rate
        return amplitude
