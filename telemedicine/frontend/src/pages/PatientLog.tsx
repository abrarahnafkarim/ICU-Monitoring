import {
  Activity,
  AlertTriangle,
  Download,
  Droplets,
  HeartPulse,
  Printer,
  ScrollText,
  ShieldCheck,
  Thermometer,
  Wind,
} from "lucide-react";
import { useParams } from "react-router-dom";

import { DoctorComments } from "../components/DoctorComments";
import { Navbar } from "../components/Navbar";
import { PatientProfileCard } from "../components/PatientProfileCard";
import { Card } from "../components/ui/Card";
import { useEvents } from "../hooks/useEvents";
import { usePatient } from "../hooks/usePatient";
import { useVitals } from "../hooks/useVitals";
import { downloadLogCsv } from "../lib/exportLog";
import type { PatientEvent } from "../types";

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const SEVERITY_DOT = {
  danger: "bg-danger",
  warning: "bg-warning",
} as const;

function VitalChip({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof HeartPulse;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <Icon size={20} strokeWidth={2.2} className="text-primary" />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold text-text">
          {value}
          {unit && <span className="ml-1 text-xs font-medium text-muted">{unit}</span>}
        </p>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: PatientEvent }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[event.severity]}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-text">{event.title}</p>
          <span className="shrink-0 text-xs text-muted">
            {formatStamp(event.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted">{event.detail}</p>
      </div>
    </li>
  );
}

export function PatientLog() {
  const { patientId } = useParams<{ patientId: string }>();
  const patient = usePatient(patientId);
  const { vitals, status } = useVitals(patient.patient_id);
  const { events, loading } = useEvents(patient.patient_id);

  return (
    <div className="min-h-screen">
      <Navbar online={status === "online"} showBack />

      <main
        id="printable-log"
        className="safe-bottom mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-6 sm:px-6"
      >
        <div className="animate-fade-in flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText size={20} className="text-primary" strokeWidth={2.2} />
            <h1 className="text-xl font-bold text-text">Log Overview</h1>
          </div>
          <div className="no-print flex items-center gap-2">
            <button
              onClick={() => downloadLogCsv(patient, vitals, events)}
              className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Download size={14} strokeWidth={2.2} />
              Download CSV
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Printer size={14} strokeWidth={2.2} />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="animate-fade-in">
          <PatientProfileCard patient={patient} />
        </div>

        {/* Current vitals snapshot */}
        <section className="animate-fade-in">
          <h2 className="section-title mb-3">Current Vitals</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <VitalChip
              icon={HeartPulse}
              label="Heart Rate"
              value={vitals ? String(vitals.heart_rate) : "—"}
              unit="BPM"
            />
            <VitalChip
              icon={Droplets}
              label="SpO₂"
              value={vitals ? String(vitals.spo2) : "—"}
              unit="%"
            />
            <VitalChip
              icon={Thermometer}
              label="Temperature"
              value={vitals ? vitals.temperature.toFixed(1) : "—"}
              unit="°C"
            />
            <VitalChip
              icon={Wind}
              label="Respiratory"
              value={vitals ? String(vitals.respiratory_rate) : "—"}
              unit="br/min"
            />
            <VitalChip
              icon={Activity}
              label="ECG"
              value={vitals ? vitals.ecg_status : "—"}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Event log */}
          <section className="animate-fade-in lg:col-span-7">
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <AlertTriangle size={18} strokeWidth={2.2} />
                  </span>
                  <h2 className="text-base font-semibold text-text">Event Log</h2>
                </div>
                {events.length > 0 && (
                  <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-semibold text-muted">
                    {events.length} events
                  </span>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-muted">Loading event log…</p>
              ) : events.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-6 text-success">
                  <ShieldCheck size={22} strokeWidth={2.2} />
                  <div>
                    <p className="text-sm font-semibold">No events logged</p>
                    <p className="text-xs text-success/70">
                      No alert thresholds have been crossed.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </ul>
              )}
            </Card>
          </section>

          {/* Doctor comments */}
          <section className="animate-fade-in lg:col-span-5">
            <DoctorComments patientId={patient.patient_id} />
          </section>
        </div>
      </main>
    </div>
  );
}
