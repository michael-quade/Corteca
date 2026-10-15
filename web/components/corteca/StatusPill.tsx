"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";

export type PillTone = "good" | "fair" | "poor" | "neutral" | "info";

const TONE: Record<PillTone, string> = {
  good: "bg-emerald-100 text-emerald-800",
  fair: "bg-yellow-100 text-yellow-800",
  poor: "bg-red-100 text-red-700",
  neutral: "bg-neutral-100 text-neutral-600",
  info: "bg-blue-50 text-blue-700",
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

/** Good / Fair / Poor from a percentage: ≥ good → Good, ≥ fair → Fair, else Poor. */
export function toneForPercent(pct: number, good: number, fair: number): { tone: PillTone; label: string } {
  if (pct >= good) return { tone: "good", label: "Good" };
  if (pct >= fair) return { tone: "fair", label: "Fair" };
  return { tone: "poor", label: "Poor" };
}
