/** Shared TypeScript interfaces for the Remote Patient Monitoring app. */

/** Demo patient profile returned by `GET /patient`. */
export interface Patient {
  name: string;
  patient_id: string;
  age: number;
  gender: string;
  status: string;
}

/** Live vital signs returned by `GET /latest-vitals`. */
export interface Vitals {
  heart_rate: number;
  spo2: number;
  temperature: number;
  ecg_status: string;
}

/** A single ECG sample (time in seconds, amplitude). */
export interface EcgSample {
  t: number;
  v: number;
}

/** Batch message pushed over the `/ws/ecg` WebSocket. */
export interface EcgMessage {
  sample_rate: number;
  samples: EcgSample[];
}

/** Connection lifecycle state shared by the API and WebSocket layers. */
export type ConnectionStatus = "connecting" | "online" | "offline";

/** A hardware sensor's reported health. */
export interface SensorStatus {
  id: string;
  name: string;
  description: string;
  connected: boolean;
}

/** Severity levels used by the alert panel. */
export type AlertSeverity = "danger" | "warning";

/** A single triggered clinical alert. */
export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
}
