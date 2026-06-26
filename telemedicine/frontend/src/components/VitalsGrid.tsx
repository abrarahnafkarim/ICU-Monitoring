import { Activity, Droplets, HeartPulse, Thermometer, Wind } from "lucide-react";

import { MetricCard, type MetricAccent } from "./MetricCard";
import type { Vitals } from "../types";

const PLACEHOLDER = "—";

function ecgAccent(status: string | undefined): MetricAccent {
  if (!status || status === "Normal") return "success";
  return "warning";
}

function rrAccent(rr: number | undefined): MetricAccent {
  if (rr === undefined) return "primary";
  return rr < 12 || rr > 20 ? "warning" : "primary";
}

/**
 * The live-vital metric cards: heart rate, SpO₂, temperature, respiratory
 * rate, and ECG status.
 */
export function VitalsGrid({ vitals }: { vitals: Vitals | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      <MetricCard
        label="Heart Rate"
        value={vitals ? vitals.heart_rate : PLACEHOLDER}
        unit="BPM"
        icon={HeartPulse}
        accent="danger"
        caption="Normal range 60–100 BPM"
      />
      <MetricCard
        label="SpO₂"
        value={vitals ? vitals.spo2 : PLACEHOLDER}
        unit="%"
        icon={Droplets}
        accent="primary"
        caption="Blood oxygen saturation"
      />
      <MetricCard
        label="Body Temperature"
        value={vitals ? vitals.temperature.toFixed(1) : PLACEHOLDER}
        unit="°C"
        icon={Thermometer}
        accent="warning"
        caption="Non-contact infrared"
      />
      <MetricCard
        label="Respiratory Rate"
        value={vitals ? vitals.respiratory_rate : PLACEHOLDER}
        unit="br/min"
        icon={Wind}
        accent={rrAccent(vitals?.respiratory_rate)}
        caption="Fused: PPG + ECG-derived"
      />
      <MetricCard
        label="ECG Status"
        value={vitals ? vitals.ecg_status : PLACEHOLDER}
        icon={Activity}
        accent={ecgAccent(vitals?.ecg_status)}
        caption="Rhythm classification"
      />
    </div>
  );
}
