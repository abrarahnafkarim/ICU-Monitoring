import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import type { PatientEvent } from "../types";

const POLL_INTERVAL_MS = 5000;

interface UseEventsResult {
  events: PatientEvent[];
  loading: boolean;
  error: string | null;
}

/**
 * Loads a patient's clinical event log and polls so new events (from any
 * viewer / the live monitor) appear without a manual refresh.
 */
export function useEvents(patientId: string): UseEventsResult {
  const [events, setEvents] = useState<PatientEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    setLoading(true);

    const refresh = async () => {
      try {
        const data = await api.getEvents(patientId);
        if (activeRef.current) {
          setEvents(data);
          setError(null);
        }
      } catch {
        if (activeRef.current) setError("Could not load event log");
      } finally {
        if (activeRef.current) setLoading(false);
      }
    };

    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      activeRef.current = false;
      window.clearInterval(timer);
    };
  }, [patientId]);

  return { events, loading, error };
}
