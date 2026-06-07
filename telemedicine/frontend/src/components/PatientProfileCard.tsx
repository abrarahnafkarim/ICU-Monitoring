import { Card } from "./ui/Card";
import { OnlineIndicator } from "./ui/OnlineIndicator";
import type { Patient } from "../types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}

/** Large patient identity card shown at the top of the dashboard. */
export function PatientProfileCard({ patient }: { patient: Patient }) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/20">
            {initials(patient.name)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">{patient.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <span>Patient ID {patient.patient_id}</span>
              <span className="h-1 w-1 rounded-full bg-muted/60" />
              <OnlineIndicator online label={patient.status} />
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <Field label="Patient ID" value={patient.patient_id} />
          <Field label="Age" value={patient.age} />
          <Field label="Gender" value={patient.gender} />
          <Field label="Status" value={patient.status} />
        </dl>
      </div>
    </Card>
  );
}
