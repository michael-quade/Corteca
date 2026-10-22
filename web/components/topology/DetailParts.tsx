"use client";

import type { ReactNode } from "react";
import { formatRate } from "@/web/lib/rateFormat";
import { cn } from "@/web/lib/utils";

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-100 px-4 py-3 first:border-t-0">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{title}</h4>
      <dl className="space-y-1.5 text-xs">{children}</dl>
    </section>
  );
}

export function DetailRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-shrink-0 text-neutral-500">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right font-medium text-neutral-800", mono && "font-mono text-[11px]")}>{children}</dd>
    </div>
  );
}

/** Inline link-style button that moves the selection to another node. */
export function JumpButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900">
      {children}
    </button>
  );
}

export function formatMbps(mbps: number | null | undefined): string | null {
  if (mbps == null || mbps <= 0) return null;
  return formatRate(mbps, 2);
}

export function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * The user's nickname when there is one ("MBR · Beacon 10"); otherwise the formal
 * model name, with the gateway prefixed and beacons given their last two MAC octets
 * so several identical models ("Beacon 10") can be told apart in lists.
 */
export function apLabel(ap: { role: string; model: string; mac: string; nickname?: string }): string {
  if (ap.nickname) return `${ap.nickname} · ${ap.model}`;
  return ap.role === "root" ? `Gateway · ${ap.model}` : `${ap.model} · ${ap.mac.slice(-5)}`;
}
