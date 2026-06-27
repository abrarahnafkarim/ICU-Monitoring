import { AlertTriangle, X } from "lucide-react";

import { useNotifications } from "./NotificationsContext";

const SEVERITY_STYLES = {
  danger: "border-danger/40 bg-danger/15 text-danger",
  warning: "border-warning/40 bg-warning/15 text-warning",
} as const;

/** Stacked transient alerts in the corner, fed by the notifications monitor. */
export function ToastHost() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="safe-top pointer-events-none fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:items-end">
      {toasts.slice(0, 4).map((t) => (
        <div
          key={t.key}
          className={`glass-card pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3 shadow-glow animate-fade-in ${SEVERITY_STYLES[t.severity]}`}
          role="alert"
        >
          <AlertTriangle size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text">
              {t.patientName} · {t.title}
            </p>
            <p className="text-xs text-muted">{t.detail}</p>
          </div>
          <button
            onClick={() => dismissToast(t.key)}
            aria-label="Dismiss"
            className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-white/10 hover:text-text"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      ))}
    </div>
  );
}
