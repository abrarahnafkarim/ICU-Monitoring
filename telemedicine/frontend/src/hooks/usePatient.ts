import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { Patient } from "../types";

/**
 * Fetches the demo patient profile once on mount.
 * Falls back to a static profile if the backend is unreachable so the
 * dashboard still renders during a demo.
 */
const FALLBACK_PATIENT: Patient = {
  name: "Patient 1",
  patient_id: "P-001",
  age: 22,
  gender: "Male",
  status: "Monitoring Active",
};

export function usePatient(): Patient {
  const [patient, setPatient] = useState<Patient>(FALLBACK_PATIENT);

  useEffect(() => {
    let active = true;
    api
      .getPatient()
      .then((data) => {
        if (active) setPatient(data);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return patient;
}
