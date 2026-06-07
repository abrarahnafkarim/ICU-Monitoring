"""
Sensor package for the Remote Patient Monitoring backend.

Each module exposes a small, clean function-based interface so that the
simulated data sources can be swapped out for real Raspberry Pi hardware
drivers without touching the API / WebSocket layer.

Hardware mapping (Raspberry Pi):
    - ad8232.py    -> AD8232 single-lead ECG analog front-end (read via ADC)
    - max30102.py  -> MAX30102 pulse-oximeter / heart-rate sensor (I2C)
    - mlx90614.py  -> MLX90614 non-contact IR body temperature sensor (I2C)
"""
