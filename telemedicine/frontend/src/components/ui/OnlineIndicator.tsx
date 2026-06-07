interface OnlineIndicatorProps {
  online?: boolean;
  label?: string;
  className?: string;
}

/** A pulsing status dot with an optional text label. */
export function OnlineIndicator({
  online = true,
  label,
  className = "",
}: OnlineIndicatorProps) {
  const dotColor = online ? "bg-success" : "bg-danger";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        {online && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-60 animate-pulse-ring`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
      </span>
      {label && (
        <span className="text-sm font-medium text-text">{label}</span>
      )}
    </span>
  );
}
