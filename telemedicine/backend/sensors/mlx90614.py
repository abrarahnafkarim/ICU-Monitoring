"""
MLX90614 non-contact infrared body-temperature sensor interface.

SIMULATION MODE (default):
    Returns a body temperature in degrees Celsius that drifts slightly
    around a healthy baseline.

RASPBERRY PI MODE (future):
    Replace the body below with a read from an MLX90614 I2C driver, e.g.:

        from smbus2 import SMBus
        from mlx90614 import MLX90614
        def read_temperature() -> float:
            return round(sensor.get_object_1(), 1)
"""

from __future__ import annotations

import random

_TEMP_BASELINE = 36.7
_temp = _TEMP_BASELINE


def read_temperature() -> float:
    """Return body temperature in degrees Celsius (one decimal place)."""
    global _temp
    _temp += random.gauss(0.0, 0.03) + (_TEMP_BASELINE - _temp) * 0.05
    _temp = max(36.2, min(37.5, _temp))
    return round(_temp, 1)


def is_connected() -> bool:
    """Report sensor health. Always True in simulation mode."""
    return True
