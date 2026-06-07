import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Lightly frosted surface used as the base for every panel. */
export function Card({ children, className = "" }: CardProps) {
  return <div className={`glass-card ${className}`}>{children}</div>;
}
