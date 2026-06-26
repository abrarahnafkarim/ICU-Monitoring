"""
Respiratory rate via sensor fusion (the "best stack").

We estimate respiratory rate (RR) two independent ways from sensors you already
have, then **fuse** them into one robust value:

  1. RR-PPG  — from the MAX30102. Breathing modulates the pulse (PPG) waveform
     (amplitude / baseline / frequency). Extracting the slow ~0.1-0.5 Hz
     oscillation gives breaths per minute.
  2. EDR     — ECG-Derived Respiration, from the AD8232. Breathing shifts the
     heart's electrical axis, so the R-peak amplitude rises and falls once per
     breath. The frequency of that envelope is the respiratory rate.

Two estimates beat one: each method fails in different conditions (PPG hates
poor perfusion / finger motion; EDR hates muscle noise / loose electrodes), so
cross-checking them and weighting by signal quality yields a far steadier
number than either alone.

================================ HARDWARE MODE ================================
The fusion below (:func:`fuse_respiratory_rate`) is the *real* algorithm — it
runs in simulation too. To go live you only replace the two **inputs**: compute
``rr_ppg`` from a window of MAX30102 IR samples and ``rr_edr`` from a window of
R-peak amplitudes, each with a 0..1 quality score, e.g.:

    # PPG-derived RR (MAX30102 IR buffer, ~30 s at the PPG sample rate)
    rr_ppg, q_ppg = estimate_rr_from_ppg(ir_window, fs_ppg)
    # ECG-derived RR (R-peak amplitudes over the same window)
    rr_edr, q_edr = estimate_rr_from_edr(r_peak_amplitudes, r_peak_times)
    rr, quality, source = fuse_respiratory_rate(rr_ppg, q_ppg, rr_edr, q_edr)

`estimate_rr_from_*` are typically: band-pass 0.1-0.5 Hz -> FFT / Welch PSD ->
pick the dominant peak in the breathing band; quality = peak prominence / SNR.
==============================================================================
"""

from __future__ import annotations

import random
from typing import Optional, Tuple

# Plausible adult respiratory band (breaths per minute).
RR_MIN = 8.0
RR_MAX = 30.0

# If the two estimates agree within this many breaths/min, trust both and take
# a quality-weighted average. If they diverge, defer to the higher-quality one.
AGREEMENT_TOLERANCE = 4.0

# Minimum quality for an estimate to be considered usable at all.
MIN_USABLE_QUALITY = 0.25


def fuse_respiratory_rate(
    rr_ppg: Optional[float],
    q_ppg: float,
    rr_edr: Optional[float],
    q_edr: float,
) -> Tuple[Optional[float], float, str]:
    """
    Fuse the PPG-derived and ECG-derived respiratory rates.

    Returns ``(rr, quality, source)`` where ``rr`` is breaths/min (or None if
    neither input is usable), ``quality`` is a 0..1 confidence, and ``source``
    is one of ``"fused"``, ``"ppg"``, ``"edr"`` or ``"none"``.

    Strategy:
      * Drop any estimate below ``MIN_USABLE_QUALITY`` or outside the RR band.
      * Both usable & agree  -> quality-weighted average (most robust).
      * Both usable & differ -> take the higher-quality estimate.
      * Only one usable      -> use it.
      * Neither usable       -> (None, 0, "none"); caller holds last good value.
    """
    ppg_ok = rr_ppg is not None and q_ppg >= MIN_USABLE_QUALITY and _in_band(rr_ppg)
    edr_ok = rr_edr is not None and q_edr >= MIN_USABLE_QUALITY and _in_band(rr_edr)

    if ppg_ok and edr_ok:
        assert rr_ppg is not None and rr_edr is not None  # for type-checkers
        if abs(rr_ppg - rr_edr) <= AGREEMENT_TOLERANCE:
            total = q_ppg + q_edr
            rr = (rr_ppg * q_ppg + rr_edr * q_edr) / total
            # Agreement boosts confidence above either method alone.
            quality = min(1.0, (q_ppg + q_edr) / 2.0 + 0.15)
            return rr, quality, "fused"
        # Disagreement: the cleaner signal wins.
        if q_ppg >= q_edr:
            return rr_ppg, q_ppg * 0.8, "ppg"
        return rr_edr, q_edr * 0.8, "edr"

    if ppg_ok:
        return rr_ppg, q_ppg, "ppg"
    if edr_ok:
        return rr_edr, q_edr, "edr"
    return None, 0.0, "none"


def _in_band(rr: float) -> bool:
    return RR_MIN <= rr <= RR_MAX


# --------------------------------------------------------------------------- #
# Simulation: produce two noisy method estimates around a shared "true" RR and
# run them through the real fusion above, so the fused output behaves like the
# hardware will. The only thing that changes on real hardware is where rr_ppg /
# rr_edr come from.
# --------------------------------------------------------------------------- #
_RR_BASELINE = 16.0
_true_rr = _RR_BASELINE
_last_good = _RR_BASELINE


def _simulate_method(true_rr: float, noise_sd: float, quality: float) -> Tuple[float, float]:
    """One method's noisy estimate of the true RR, plus a jittered quality."""
    est = true_rr + random.gauss(0.0, noise_sd)
    q = max(0.0, min(1.0, quality + random.gauss(0.0, 0.08)))
    return est, q


def read_respiratory_rate() -> int:
    """
    Return the fused respiratory rate in breaths per minute.

    Drives a shared true RR with a gentle random walk, simulates the PPG and
    EDR estimates of it, and fuses them through :func:`fuse_respiratory_rate`.
    """
    global _true_rr, _last_good

    # Random walk the underlying breathing rate, drifting back to baseline.
    _true_rr += random.gauss(0.0, 0.3) + (_RR_BASELINE - _true_rr) * 0.05
    _true_rr = max(10.0, min(22.0, _true_rr))

    # PPG is usually slightly noisier than EDR at rest; both are good here.
    rr_ppg, q_ppg = _simulate_method(_true_rr, noise_sd=1.1, quality=0.82)
    rr_edr, q_edr = _simulate_method(_true_rr, noise_sd=0.8, quality=0.88)

    rr, _quality, _source = fuse_respiratory_rate(rr_ppg, q_ppg, rr_edr, q_edr)
    if rr is not None:
        _last_good = rr
    return int(round(_last_good))


def is_connected() -> bool:
    """Report sensor health. Always True in simulation mode."""
    return True
