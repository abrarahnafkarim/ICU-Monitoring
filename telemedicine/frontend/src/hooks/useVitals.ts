import { useEffect, useState } from "react";

import { api } from "../api/client";
import { config } from "../config";
import type { ConnectionStatus, Vitals } from "../types";

interface UseVitalsResult {
  vitals: Vitals | null;
  status: ConnectionStatus;
}

/**
 * Polls `GET /latest-vitals` on a fixed interval and exposes the most recent
 * reading along with the backend connection status.
 *
 * Pass a patient id to fetch that patient's vitals (Patient 2 returns its own
 * independent simulation; Patient 1 / no id uses the Pi or its fallback).
 */
export function useVitals(patientId?: string): UseVitalsResult {
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const data = await api.getLatestVitals(patientId);
        if (!active) return;
        setVitals(data);
        setStatus("online");
      } catch {
        if (active) setStatus("offline");
      } finally {
        if (active) {
          timer = window.setTimeout(poll, config.vitalsPollInterval);
        }
      }
    };

    poll();

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [patientId]);

  return { vitals, status };
}
