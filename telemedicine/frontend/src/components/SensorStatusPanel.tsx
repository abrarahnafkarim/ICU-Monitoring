import { Cpu } from "lucide-react";

import { Card } from "./ui/Card";
import { OnlineIndicator } from "./ui/OnlineIndicator";
import type { SensorStatus } from "../types";

/**
 * The three hardware sensors wired to the Raspberry Pi. In simulation mode
 * they always report "Connected"; on real hardware each module's
 * `is_connected()` result would drive these flags.
 */
const SENSORS: SensorStatus[] = [
  {
    id: "ad8232",
    name: "AD8232",
    description: "Single-lead ECG front-end",
    connected: true,
  },
  {
    id: "max30102",
    name: "MAX30102",
    description: "Pulse oximeter · HR / SpO₂",
    connected: true,
  },
  {
    id: "mlx90614",
    name: "MLX90614",
    description: "Infrared body temperature",
    connected: true,
  },
];

export function SensorStatusPanel() {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Cpu size={18} strokeWidth={2.2} />
        </span>
        <h2 className="text-base font-semibold text-text">Sensor Status</h2>
      </div>

      <ul className="flex flex-col gap-3">
        {SENSORS.map((sensor) => (
          <li
            key={sensor.id}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-text">{sensor.name}</p>
              <p className="text-xs text-muted">{sensor.description}</p>
            </div>
            <OnlineIndicator
              online={sensor.connected}
              label={sensor.connected ? "Connected" : "Offline"}
              className="text-success"
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
