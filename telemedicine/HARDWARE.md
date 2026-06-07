# Connecting Real Sensors (Raspberry Pi)

This guide takes the demo from **simulated data → live hardware**. You only
edit the three files in `backend/sensors/`. The API, WebSocket, and the entire
React frontend stay exactly the same.

---

## 0. The two things that change architecturally

1. **The backend must run *on* the Raspberry Pi.** The I²C bus and GPIO pins
   are physical to the Pi, so `uvicorn` runs there. Your laptop just opens the
   browser and points at the Pi's IP.
2. **The AD8232 is analog. The Pi has no analog input.** You need a small
   **ADS1115** (16-bit I²C ADC) between the AD8232 and the Pi. The MAX30102 and
   MLX90614 are already digital (I²C) and wire straight to the Pi.

---

## 1. Parts list

| Part | Role | Interface | I²C address |
| --- | --- | --- | --- |
| Raspberry Pi (3/4/5 or Zero 2 W) | Runs the backend | — | — |
| **AD8232** ECG module + 3-lead cable + electrode pads | ECG waveform | Analog out | — |
| **ADS1115** ADC breakout | Digitises AD8232 output | I²C | `0x48` |
| **MAX30102** (often a purple "GY-MAX30102" board) | Heart rate + SpO₂ | I²C | `0x57` |
| **MLX90614** | Body temperature (IR) | I²C | `0x5A` |
| Breadboard + jumper wires | Fan out the shared I²C bus | — | — |

All three I²C devices have **different addresses**, so they happily share the
same SDA/SCL bus.

---

## Set up the Pi & copy the backend across

> **Which files go on the Pi?** Only the **`backend/`** folder. Leave the
> frontend on your laptop (it just points at the Pi over WiFi), and do **not**
> copy `.venv` (Windows-only) or `__pycache__`.

**1. Flash the OS (no monitor needed).** In **Raspberry Pi Imager**, choose
**Raspberry Pi OS Lite**, click the ⚙️ gear, and set: hostname `raspberrypi`,
enable **SSH**, a username/password, and your **WiFi**. Write the card and boot.

**2. SSH in and prep (one time):**

```bash
ssh pi@raspberrypi.local
sudo apt update
sudo apt install -y python3-venv python3-pip i2c-tools git
sudo raspi-config      # Interface Options → I2C → Enable
sudo reboot
```

**3. Copy the backend from your laptop** (PowerShell — copies source only,
skips the Windows venv):

```powershell
cd "c:\Users\My\Documents\Projects\Client Project\ICU monitoring System\telemedicine\backend"
ssh pi@raspberrypi.local "mkdir -p ~/telemedicine-backend"
scp -r main.py requirements.txt requirements-pi.txt api sensors websocket pi@raspberrypi.local:~/telemedicine-backend/
```

Then continue with §2–§7 below (the working directory on the Pi is
`~/telemedicine-backend`).

---

## 2. Enable I²C on the Pi

```bash
sudo raspi-config          # Interface Options → I2C → Enable, then reboot
sudo apt update
sudo apt install -y python3-smbus i2c-tools
```

After wiring (next section), confirm all three devices are detected:

```bash
i2cdetect -y 1
# Expect to see: 48 (ADS1115), 57 (MAX30102), 5a (MLX90614)
```

> **MLX90614 not showing / read errors?** It uses SMBus clock stretching the
> Pi doesn't fully support at full speed. Slow the bus down: add
> `dtparam=i2c_arm_baudrate=10000` to `/boot/firmware/config.txt`
> (older OS: `/boot/config.txt`) and reboot.

---

## 3. Wiring

Raspberry Pi 40-pin header references used below:
**3.3V = pin 1**, **5V = pin 2**, **GND = pin 6**, **SDA1 (GPIO2) = pin 3**, **SCL1 (GPIO3) = pin 5**.

### ADS1115  (digitises the ECG)
| ADS1115 | → Pi |
| --- | --- |
| VDD | 3.3V (pin 1) |
| GND | GND (pin 6) |
| SCL | SCL / GPIO3 (pin 5) |
| SDA | SDA / GPIO2 (pin 3) |
| A0  | ← AD8232 **OUTPUT** |

### AD8232  (ECG front-end)
| AD8232 | → |
| --- | --- |
| 3.3V | Pi 3.3V |
| GND | Pi GND |
| OUTPUT | ADS1115 **A0** |
| LO+ | (optional) GPIO17 (pin 11) — leads-off detect |
| LO- | (optional) GPIO27 (pin 13) — leads-off detect |
| SDN | leave unconnected (or tie to 3.3V) |

Electrode placement (3-lead cable): **RA** → right arm/chest, **LA** → left
arm/chest, **RL** → right leg (reference). For a quick test, the two upper pads
on the chest + reference on the lower side works well.

### MAX30102  (HR + SpO₂)
| MAX30102 | → Pi |
| --- | --- |
| VIN | 3.3V (some purple boards want 5V VIN — check the silkscreen) |
| GND | GND |
| SCL | SCL / GPIO3 (pin 5) |
| SDA | SDA / GPIO2 (pin 3) |
| INT | (optional) leave unconnected |

### MLX90614  (temperature)
| MLX90614 | → Pi |
| --- | --- |
| VIN | 3.3V |
| GND | GND |
| SCL | SCL / GPIO3 (pin 5) |
| SDA | SDA / GPIO2 (pin 3) |

> Tip: use the breadboard power rails for 3.3V and GND, and run a single
> SDA and SCL rail that all three boards tap into.

---

## 4. Install the Pi drivers

```bash
cd telemedicine/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-pi.txt
# MAX30102 community driver (also provides the hrcalc algorithm):
pip install git+https://github.com/doug-burrell/max30102.git
```

---

## 5. Replace the simulated code (the only edits you make)

Each module already documents exactly what to swap. Drop-in implementations:

### `sensors/ad8232.py`

```python
import board, busio
import adafruit_ads1x15.ads1115 as ADS
from adafruit_ads1x15.analog_in import AnalogIn

SAMPLE_RATE = 250

_i2c = busio.I2C(board.SCL, board.SDA)
_ads = ADS.ADS1115(_i2c)
_ads.data_rate = 860                 # fastest rate — good headroom for ECG
_ads.mode = ADS.Mode.CONTINUOUS      # keep converting in the background
_chan = AnalogIn(_ads, ADS.P0)       # AD8232 OUTPUT wired to A0

_baseline = 1.65                     # AD8232 idles near mid-rail (~1.65 V)

def read_ecg_sample() -> float:
    """Return one ECG sample, high-pass filtered to centre near 0."""
    global _baseline
    v = _chan.voltage
    _baseline += 0.001 * (v - _baseline)   # slow baseline (DC) tracker
    return v - _baseline

def set_heart_rate(_heart_rate: float) -> None:
    pass  # no-op on hardware; the real heart sets the rhythm

def is_connected() -> bool:
    return True
```

> **Y-axis:** real ECG amplitudes won't match the simulator's fixed range. In
> `frontend/src/components/EcgChart.tsx`, change the `yaxis` to autoscale —
> replace `fixedrange: true, range: [-0.6, 1.3]` with
> `fixedrange: true, autorange: true`.

### `sensors/max30102.py`

```python
import max30102, hrcalc

_sensor = max30102.MAX30102()
_last = {"hr": 0, "spo2": 0}

def _refresh() -> None:
    red, ir = _sensor.read_sequential()          # buffers of samples
    hr, hr_ok, spo2, spo2_ok = hrcalc.calc_hr_and_spo2(ir, red)
    if hr_ok and 30 < hr < 220:
        _last["hr"] = int(hr)
    if spo2_ok and 70 <= spo2 <= 100:
        _last["spo2"] = int(spo2)

def read_heart_rate() -> int:
    _refresh()                                    # one read updates both
    return _last["hr"]

def read_spo2() -> int:
    return _last["spo2"]                          # uses the latest refresh

def is_connected() -> bool:
    return True
```

> A finger must be resting on the sensor for valid HR/SpO₂. The Maxim
> peak-detection algorithm needs a few seconds of data to lock on, so the first
> couple of readings may be `0` — that's normal.

### `sensors/mlx90614.py`

```python
from smbus2 import SMBus
from mlx90614 import MLX90614

_bus = SMBus(1)                       # I2C bus 1 on the Pi
_sensor = MLX90614(_bus, address=0x5A)

def read_temperature() -> float:
    return round(_sensor.get_object_1(), 1)   # object (body) temp in °C

def is_connected() -> bool:
    return True
```

---

## 6. Run the sender on the Pi (push data to your website)

The Pi does **not** run a server. It runs `pi_sender.py`, which reads the
sensors and pushes the data up to your **hosted** dashboard. You only need to
copy `sensors/`, `pi_sender.py`, and `requirements-pi.txt` to the Pi.

```bash
pip install -r requirements-pi.txt
export RPM_SERVER="https://your-app.example.com"   # your hosted dashboard
export RPM_INGEST_TOKEN="your-secret"              # must match the server
python pi_sender.py
```

You should see `streaming to wss://…/ingest/ecg` and the live dashboard switch
from simulated to real data within a second or two. (Hosting the dashboard app
itself is covered in **[README.md → Going live](README.md)**.)

> Want to keep it simple and test on your LAN first? Run the FastAPI app on your
> laptop (`uvicorn main:app --host 0.0.0.0 --port 8000`), then on the Pi set
> `RPM_SERVER=http://<laptop-ip>:8000` and run `pi_sender.py`. Same flow, no
> domain needed.

---

## 7. Bring-up order (test one sensor at a time)

Edit the sensor files on the Pi, then run `python pi_sender.py` and watch the
hosted dashboard (or `GET /latest-vitals` on the server) update.

1. `i2cdetect -y 1` shows `48`, `57`, `5a`. ✅ wiring is good.
2. **Temperature first** (simplest): edit `mlx90614.py` → `temperature` should
   track a real object / your skin.
3. **MAX30102 next**: edit `max30102.py`, rest a finger on it → `heart_rate` /
   `spo2` settle to real values (give it a few seconds to lock on).
4. **ECG last** (trickiest): edit `ad8232.py` + set the chart `yaxis` to
   autorange. Attach electrodes — you should see a live trace. Stay still;
   muscle movement adds noise.

---

## 8. What next (roadmap beyond the demo)

- **Leads-off detection:** read the AD8232 `LO+/LO-` GPIO pins; when high, send
  an `ecg_status: "Leads Off"` so the UI can warn instead of showing flatline.
- **Server-side alerting:** the alert rules currently live in the frontend
  (`src/lib/alerts.ts`). If you want alerts independent of an open browser,
  evaluate them in `api/routes.py` too.
- **Signal smoothing:** add a simple moving-average / band-pass filter in
  `read_ecg_sample()` if the raw trace is noisy.
- **Run on boot:** wrap `uvicorn` in a `systemd` service so monitoring starts
  automatically when the Pi powers up.

> Keep the simulated versions in git history (or commented out) so you can fall
> back to demo mode any time the hardware isn't connected.
