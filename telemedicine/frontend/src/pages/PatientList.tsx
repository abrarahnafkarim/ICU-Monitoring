import { ChevronRight, Droplets, HeartPulse, Thermometer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Navbar } from "../components/Navbar";
import { OnlineIndicator } from "../components/ui/OnlineIndicator";
import { usePatient } from "../hooks/usePatient";
import { useVitals } from "../hooks/useVitals";

function MiniVital({
  icon: Icon,
  value,
  unit,
  accent,
}: {
  icon: typeof HeartPulse;
  value: string;
  unit: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className={accent} strokeWidth={2.2} />
      <span className="text-lg font-bold text-text">{value}</span>
      <span className="text-xs text-muted">{unit}</span>
    </div>
  );
}

export function PatientList() {
  const navigate = useNavigate();
  const patient = usePatient();
  const { vitals, status } = useVitals();

  return (
    <div className="min-h-screen">
      <Navbar online={status === "online"} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 animate-fade-in">
          <h1 className="text-2xl font-bold text-text">
            Remote Monitoring Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted">
            Monitored patients · live overview
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="glass-card group flex flex-col gap-5 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow animate-fade-in"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 font-bold text-primary ring-1 ring-primary/20">
                  {patient.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div>
                  <p className="font-semibold text-text">{patient.name}</p>
                  <p className="text-xs text-muted">ID {patient.patient_id}</p>
                </div>
              </div>
              <OnlineIndicator online label="Online" />
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/5 pt-4">
              <MiniVital
                icon={HeartPulse}
                value={vitals ? String(vitals.heart_rate) : "76"}
                unit="BPM"
                accent="text-danger"
              />
              <MiniVital
                icon={Droplets}
                value={vitals ? String(vitals.spo2) : "98"}
                unit="%"
                accent="text-primary"
              />
              <MiniVital
                icon={Thermometer}
                value={vitals ? vitals.temperature.toFixed(1) : "36.7"}
                unit="°C"
                accent="text-warning"
              />
            </div>

            <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              Open dashboard <ChevronRight size={16} />
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
