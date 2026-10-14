"use client";

import type { ReactNode } from "react";
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
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${Math.round(mbps)} Mbps`;
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

export function apLabel(role: string, model: string): string {
  return `${role === "root" ? "Gateway" : "Beacon"} · ${model}`;
}
