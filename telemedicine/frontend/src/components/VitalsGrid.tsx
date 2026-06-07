import { Activity, Droplets, HeartPulse, Thermometer } from "lucide-react";

import { MetricCard, type MetricAccent } from "./MetricCard";
import type { Vitals } from "../types";

const PLACEHOLDER = "—";

function ecgAccent(status: string | undefined): MetricAccent {
  if (!status || status === "Normal") return "success";
  return "warning";
}

/** The four live-vital metric cards: heart rate, SpO₂, temperature, ECG. */
export function VitalsGrid({ vitals }: { vitals: Vitals | null }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        label="ECG Status"
        value={vitals ? vitals.ecg_status : PLACEHOLDER}
        icon={Activity}
        accent={ecgAccent(vitals?.ecg_status)}
        caption="Rhythm classification"
      />
    </div>
  );
}
