/** Tiny typed fetch wrapper around the FastAPI REST endpoints. */

import { config } from "../config";
import type { Patient, Vitals } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${config.apiBase}${path}`);
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

  /** Fetch the latest vital signs. */
  getLatestVitals: () => getJson<Vitals>("/latest-vitals"),
};
