import { AlertTriangle, BellRing, ShieldCheck } from "lucide-react";

import { Card } from "./ui/Card";
import type { Alert } from "../types";

const SEVERITY_STYLES: Record<Alert["severity"], string> = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export function AlertPanel({ alerts }: { alerts: Alert[] }) {
  const hasAlerts = alerts.length > 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
            <BellRing size={18} strokeWidth={2.2} />
          </span>
          <h2 className="text-base font-semibold text-text">Alerts</h2>
        </div>
        {hasAlerts && (
          <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
            {alerts.length} active
          </span>
        )}
      </div>

      {!hasAlerts ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/5 px-4 py-6 text-success">
          <ShieldCheck size={22} strokeWidth={2.2} />
          <div>
            <p className="text-sm font-semibold">No Active Alerts</p>
            <p className="text-xs text-success/70">
              All vitals within normal limits.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${SEVERITY_STYLES[alert.severity]}`}
            >
              <AlertTriangle size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text">{alert.title}</p>
                <p className="text-xs text-muted">{alert.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
