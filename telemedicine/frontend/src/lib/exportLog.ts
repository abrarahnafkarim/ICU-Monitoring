import type { Patient, PatientEvent, Vitals } from "../types";

/** Escape a value for CSV (RFC 4180: wrap in quotes, double internal quotes). */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/** Trigger a browser download of `content` as a file named `filename`. */
function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** A filesystem-safe slug, e.g. "Patient 1" -> "Patient-1". */
function slug(name: string): string {
  return name.trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
}

/**
 * Export a patient's log overview (info + current vitals + event log) as a CSV
 * file the doctor can open in Excel / share.
 */
export function downloadLogCsv(
  patient: Patient,
  vitals: Vitals | null,
  events: PatientEvent[],
): void {
  const lines: string[] = [];

  lines.push(csvRow(["Patient Log Overview"]));
  lines.push(csvRow(["Generated", new Date().toLocaleString()]));
  lines.push("");

  lines.push(csvRow(["Patient Information"]));
  lines.push(csvRow(["Name", patient.name]));
  lines.push(csvRow(["Patient ID", patient.patient_id]));
  lines.push(csvRow(["Age", patient.age]));
  lines.push(csvRow(["Gender", patient.gender]));
  lines.push(csvRow(["Status", patient.status]));
  lines.push("");

  lines.push(csvRow(["Current Vitals"]));
  if (vitals) {
    lines.push(csvRow(["Heart Rate (BPM)", vitals.heart_rate]));
    lines.push(csvRow(["SpO2 (%)", vitals.spo2]));
    lines.push(csvRow(["Temperature (C)", vitals.temperature.toFixed(1)]));
    lines.push(csvRow(["Respiratory Rate (br/min)", vitals.respiratory_rate]));
    lines.push(csvRow(["ECG Status", vitals.ecg_status]));
  } else {
    lines.push(csvRow(["(no current reading)"]));
  }
  lines.push("");

  lines.push(csvRow([`Event Log (${events.length})`]));
  lines.push(csvRow(["Timestamp", "Severity", "Title", "Detail"]));
  for (const e of events) {
    lines.push(
      csvRow([
        new Date(e.timestamp).toLocaleString(),
        e.severity,
        e.title,
        e.detail,
      ]),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    `${slug(patient.name)}-log-${stamp}.csv`,
    lines.join("\r\n"),
    "text/csv",
  );
}
