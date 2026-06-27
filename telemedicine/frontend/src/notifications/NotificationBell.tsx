import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, Trash2 } from "lucide-react";

import { useNotifications, type Notification } from "./NotificationsContext";

function formatTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ts).toLocaleString();
}

const DOT = {
  danger: "bg-danger",
  warning: "bg-warning",
} as const;

function NotificationRow({ n }: { n: Notification }) {
  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 ${n.read ? "opacity-60" : ""}`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.severity]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-text">
            {n.patientName} · {n.title}
          </p>
          <span className="shrink-0 text-[11px] text-muted">
            {formatTime(n.timestamp)}
          </span>
        </div>
        <p className="text-xs text-muted">{n.detail}</p>
      </div>
    </li>
  );
}

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    markAllRead,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next && unreadCount > 0) markAllRead();
      return next;
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.03] text-muted transition-colors hover:bg-white/[0.06] hover:text-text"
      >
        {unreadCount > 0 ? (
          <BellRing size={18} strokeWidth={2.2} className="text-warning" />
        ) : (
          <Bell size={18} strokeWidth={2.2} />
        )}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-card absolute right-0 top-11 z-30 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden p-0 shadow-glow">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
              >
                <Trash2 size={13} strokeWidth={2.2} /> Clear
              </button>
            )}
          </div>

          {permission !== "granted" && permission !== "denied" && (
            <button
              onClick={requestPermission}
              className="flex w-full items-center gap-2 border-b border-white/5 bg-primary/5 px-4 py-2.5 text-left text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <Check size={14} strokeWidth={2.2} />
              Enable desktop alerts for patient issues
            </button>
          )}

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No alerts. All patients stable.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-white/5 overflow-y-auto">
              {notifications.map((n) => (
                <NotificationRow key={`${n.key}-${n.timestamp}`} n={n} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
