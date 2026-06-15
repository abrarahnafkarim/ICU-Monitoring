import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { Patient } from "../types";

/**
 * Demo patient roster.
 *
 * Both patients are fed by the same live data source (one Pi). They differ only
 * in their profile; the dashboard shows the same vitals/ECG/camera for each.
 *
 * Used as a fallback if the backend is unreachable so the dashboard still
 * renders during a demo.
 */
const FALLBACK_PATIENTS: Patient[] = [
  {
    name: "Patient 1",
    patient_id: "P-001",
    age: 22,
    gender: "Male",
    status: "Monitoring Active",
  },
  {
    name: "Patient 2",
    patient_id: "P-002",
    age: 22,
    gender: "Male",
    status: "Monitoring Active",
  },
];

/** Fetches all demo patient profiles once on mount (falls back to static). */
export function usePatients(): Patient[] {
  const [patients, setPatients] = useState<Patient[]>(FALLBACK_PATIENTS);

  useEffect(() => {
    let active = true;
    api
      .getPatients()
      .then((data) => {
        if (active && data.length > 0) setPatients(data);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return patients;
}

/**
 * Returns a single patient by id (defaults to the first one).
 * Used by the dashboard, which is opened for a specific patient.
 */
export function usePatient(patientId?: string): Patient {
  const patients = usePatients();
  if (patientId) {
    const match = patients.find((p) => p.patient_id === patientId);
    if (match) return match;
  }
  return patients[0];
}
