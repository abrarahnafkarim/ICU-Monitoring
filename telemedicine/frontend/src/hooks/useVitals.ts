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
 */
export function useVitals(): UseVitalsResult {
  const [vitals, setVitals] = useState<Vitals | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const data = await api.getLatestVitals();
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
  }, []);

  return { vitals, status };
}
