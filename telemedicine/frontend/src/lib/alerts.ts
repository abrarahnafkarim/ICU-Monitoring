import type { Alert, Vitals } from "../types";

/**
 * Evaluate the clinical alert rules against the latest vitals.
 *
 * Rules:
 *   - Heart Rate        > 120  -> danger
 *   - Heart Rate        < 50   -> danger
 *   - SpO2              < 92   -> danger
 *   - Temperature       > 38.5 -> warning
 *   - Respiratory Rate  > 24   -> warning
 *   - Respiratory Rate  < 8    -> warning
 */
export function computeAlerts(vitals: Vitals | null): Alert[] {
  if (!vitals) return [];

  const alerts: Alert[] = [];

  if (vitals.heart_rate > 120) {
    alerts.push({
      id: "hr-high",
      severity: "danger",
      title: "High Heart Rate",
      detail: `Heart rate ${vitals.heart_rate} BPM is above 120 BPM.`,
    });
  }

  if (vitals.heart_rate < 50) {
    alerts.push({
      id: "hr-low",
      severity: "danger",
      title: "Low Heart Rate",
      detail: `Heart rate ${vitals.heart_rate} BPM is below 50 BPM.`,
    });
  }

  if (vitals.spo2 < 92) {
    alerts.push({
      id: "spo2-low",
      severity: "danger",
      title: "Low Blood Oxygen",
      detail: `SpO₂ ${vitals.spo2}% is below 92%.`,
    });
  }

  if (vitals.temperature > 38.5) {
    alerts.push({
      id: "temp-high",
      severity: "warning",
      title: "High Body Temperature",
      detail: `Temperature ${vitals.temperature.toFixed(1)}°C is above 38.5°C.`,
    });
  }

  if (vitals.respiratory_rate > 24) {
    alerts.push({
      id: "rr-high",
      severity: "warning",
      title: "High Respiratory Rate",
      detail: `Respiratory rate ${vitals.respiratory_rate} br/min is above 24.`,
    });
  }

  if (vitals.respiratory_rate < 8) {
    alerts.push({
      id: "rr-low",
      severity: "warning",
      title: "Low Respiratory Rate",
      detail: `Respiratory rate ${vitals.respiratory_rate} br/min is below 8.`,
    });
  }

  return alerts;
}
