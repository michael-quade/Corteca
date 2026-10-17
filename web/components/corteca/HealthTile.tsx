"use client";

import type { ReactNode } from "react";
import { StatusPill, type PillTone } from "./StatusPill";

/**
 * Corteca health tile: outline icon, label, value, then either a status pill or a
 * plain sub-line (e.g. a share of the total). Clickable when onClick is set.
 */
export function HealthTile({ icon, label, value, pill, sub, onClick, hint }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  pill?: { tone: PillTone; label: string };
  sub?: ReactNode;
  onClick?: () => void;
  hint?: string;
}) {
  const body = (
    <>
      <span className="text-neutral-700 [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
      <span className="text-sm text-neutral-700">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-neutral-900">{value}</span>
      {pill ? (
        <StatusPill tone={pill.tone} chevron={!!onClick}>{pill.label}</StatusPill>
      ) : (
        <span className="h-5 text-xs text-neutral-500">{sub}</span>
      )}
    </>
  );
  const cls = "flex flex-col items-center gap-1.5 px-4 py-2 text-center";
  return onClick ? (
    <button type="button" onClick={onClick} title={hint} className={`${cls} rounded-xl transition-colors hover:bg-neutral-50`}>{body}</button>
  ) : (
    <div className={cls} title={hint}>{body}</div>
  );
}
