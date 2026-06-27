/** Tiny typed fetch wrapper around the FastAPI REST endpoints. */

import { config } from "../config";
import type { Comment, Patient, Vitals } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${config.apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Request to ${path} failed (${response.status})`);
  }
  return (await response.json()) as T;
}

export const api = {
  /** Fetch the demo patient profile. */
  getPatient: () => getJson<Patient>("/patient"),

  /** Fetch all demo patient profiles. */
  getPatients: () => getJson<Patient[]>("/patients"),

  /** Fetch the latest vital signs (optionally for a specific patient). */
  getLatestVitals: (patientId?: string) =>
    getJson<Vitals>(
      patientId
        ? `/latest-vitals?patient=${encodeURIComponent(patientId)}`
        : "/latest-vitals",
    ),

  /** Fetch a patient's doctor comments (newest first). */
  getComments: (patientId: string) =>
    getJson<Comment[]>(`/comments?patient=${encodeURIComponent(patientId)}`),

  /** Post a doctor comment for a patient. */
  addComment: (patientId: string, text: string, author?: string) =>
    postJson<Comment>("/comments", {
      patient_id: patientId,
      text,
      author,
    }),

  /** Demo only: force an abnormal vital so the alert/notification fires. */
  simulateAnomaly: (patientId: string, field = "heart_rate") =>
    postJson<{ ok: boolean }>("/simulate-anomaly", {
      patient_id: patientId,
      field,
      duration_seconds: 20,
    }),
};
