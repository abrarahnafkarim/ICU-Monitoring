import type { LucideIcon } from "lucide-react";

import { Card } from "./ui/Card";

export type MetricAccent = "primary" | "success" | "warning" | "danger";

interface MetricCardProps {
  label: string;
  /** The headline value (number or short text). */
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  accent?: MetricAccent;
  caption?: string;
}

const ACCENTS: Record<MetricAccent, { text: string; tint: string }> = {
  primary: { text: "text-primary", tint: "bg-primary/10" },
  success: { text: "text-success", tint: "bg-success/10" },
  warning: { text: "text-warning", tint: "bg-warning/10" },
  danger: { text: "text-danger", tint: "bg-danger/10" },
};

/**
 * A single live-vital metric tile. The headline value re-mounts on change
 * (via `key`) so it gently "pops" each time a new reading arrives.
 */
export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = "primary",
  caption,
}: MetricCardProps) {
  const colors = ACCENTS[accent];

  return (
    <Card className="flex flex-col gap-4 p-5 transition-transform duration-300 hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">{label}</span>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.tint} ${colors.text}`}
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          key={String(value)}
          className={`animate-value-pop text-4xl font-bold tracking-tight ${colors.text}`}
        >
          {value}
        </span>
        {unit && <span className="text-base font-medium text-muted">{unit}</span>}
      </div>

      {caption && <span className="text-xs text-muted">{caption}</span>}
    </Card>
  );
}
