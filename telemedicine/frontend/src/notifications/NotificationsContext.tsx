import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { api } from "../api/client";
import { computeAlerts } from "../lib/alerts";
import type { Alert, Patient } from "../types";

/** A notification raised when a patient's alert first appears. */
export interface Notification {
  /** Stable key: patient + alert rule, so the same issue isn't duplicated. */
  key: string;
  patientId: string;
  patientName: string;
  severity: Alert["severity"];
  title: string;
  detail: string;
  /** Epoch ms when the issue was first detected. */
  timestamp: number;
  read: boolean;
}

export type NotificationPermission = "default" | "granted" | "denied";

interface NotificationsValue {
  notifications: Notification[];
  unreadCount: number;
  /** Transient toasts currently on screen. */
  toasts: Notification[];
  permission: NotificationPermission;
  requestPermission: () => void;
  markAllRead: () => void;
  clearAll: () => void;
  dismissToast: (key: string) => void;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

const POLL_INTERVAL_MS = 3000;
const MAX_NOTIFICATIONS = 50;
const TOAST_TTL_MS = 6000;

/** Browser Notification support detection (SSR-safe). */
function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function currentPermission(): NotificationPermission {
  if (!notificationsSupported()) return "denied";
  return Notification.permission as NotificationPermission;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>(
    currentPermission(),
  );

  // Tracks which (patient+rule) alerts are currently active, so we only raise a
  // notification on the *transition* into an issue — not on every poll.
  const activeKeysRef = useRef<Set<string>>(new Set());

  const requestPermission = useCallback(() => {
    if (!notificationsSupported()) return;
    Notification.requestPermission().then((p) =>
      setPermission(p as NotificationPermission),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const raise = useCallback((items: Notification[]) => {
    if (items.length === 0) return;
    setNotifications((prev) => [...items, ...prev].slice(0, MAX_NOTIFICATIONS));
    setToasts((prev) => [...items, ...prev]);

    // Local OS notification (only while a document is open; no push server).
    if (notificationsSupported() && Notification.permission === "granted") {
      for (const n of items) {
        try {
          new Notification(`${n.patientName}: ${n.title}`, {
            body: n.detail,
            tag: n.key, // collapse repeats of the same issue
          });
        } catch {
          /* some browsers throw if called outside a user gesture — ignore */
        }
      }
    }
  }, []);

  // --- Global monitor: poll every patient and detect new issues. --------- //
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let patients: Patient[] = [];

    const tick = async () => {
      try {
        if (patients.length === 0) {
          patients = await api.getPatients();
        }
        const results = await Promise.all(
          patients.map(async (p) => ({
            patient: p,
            vitals: await api.getLatestVitals(p.patient_id).catch(() => null),
          })),
        );
        if (!active) return;

        const seenNow = new Set<string>();
        const fresh: Notification[] = [];

        for (const { patient, vitals } of results) {
          const alerts = computeAlerts(vitals);
          for (const alert of alerts) {
            const key = `${patient.patient_id}:${alert.id}`;
            seenNow.add(key);
            if (!activeKeysRef.current.has(key)) {
              fresh.push({
                key,
                patientId: patient.patient_id,
                patientName: patient.name,
                severity: alert.severity,
                title: alert.title,
                detail: alert.detail,
                timestamp: Date.now(),
                read: false,
              });
            }
          }
        }

        activeKeysRef.current = seenNow;
        if (fresh.length > 0) raise(fresh);
      } catch {
        /* network hiccup — try again next tick */
      } finally {
        if (active) timer = window.setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [raise]);

  // --- Auto-expire toasts. ---------------------------------------------- //
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismissToast(t.key), TOAST_TTL_MS),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        permission,
        requestPermission,
        markAllRead,
        clearAll,
        dismissToast,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
