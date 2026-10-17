"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

export type PillTone = "good" | "fair" | "poor" | "neutral" | "info" | "online";

const TONE: Record<PillTone, string> = {
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-700",
  neutral: "bg-neutral-100 text-neutral-600",
  info: "bg-blue-50 text-blue-700",
  // Stronger green than "good", for matrices where it must stand apart from "neutral" grey at a glance.
  online: "bg-green-300 text-green-900",
};

/** Corteca status pill: fully rounded pastel fill, dark text, optional chevron when it opens detail. */
export function StatusPill({ tone, children, chevron, className }: {
  tone: PillTone;
  children: ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold tabular-nums", TONE[tone], className)}>
      {children}
      {chevron && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </span>
  );
}
