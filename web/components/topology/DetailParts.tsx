"use client";

import type { ReactNode, Ref } from "react";
import { formatRate } from "@/web/lib/rateFormat";
import { cn } from "@/web/lib/utils";
import { useSectionCollapse } from "./useSectionCollapse";

/**
 * A detail-panel section that folds to its title and a one-line summary (arrow or title
 * click). Collapsed sections are remembered by `id` (default: the title without a
 * "(…)" count) across panels and reloads. `actions` sit right of the title while open;
 * `plain` = free layout instead of a definition list.
 */
export function DetailSection({ title, id, summary, actions, plain, sectionRef, children }: {
  title: string;
  id?: string;
  /** Shown under the title while collapsed. */
  summary?: ReactNode;
  actions?: ReactNode;
  plain?: boolean;
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  const key = id ?? title.replace(/\s*\(.*\)$/, "");
  const [collapsed, setCollapsed] = useSectionCollapse(key);
  return (
    <section ref={sectionRef} className="scroll-mt-2 border-t border-neutral-100 px-4 py-3 first:border-t-0">
      <div className={cn("flex items-center justify-between gap-2", !collapsed && "mb-2")}>
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? `Show ${title}` : `Minimise ${title}`}
          className="group -ml-1 flex min-w-0 items-center gap-1 rounded px-1 text-left hover:bg-neutral-50"
        >
          <svg
            className={cn("flex-shrink-0 text-neutral-400 transition-transform group-hover:text-blue-600", collapsed && "-rotate-90")}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          <h4 className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-400 group-hover:text-neutral-600">{title}</h4>
        </button>
        {!collapsed && actions}
      </div>
      {collapsed
        ? summary != null && summary !== "" && <p className="mt-0.5 truncate pl-4 text-[11px] text-neutral-500">{summary}</p>
        : plain ? children : <dl className="space-y-1.5 text-xs">{children}</dl>}
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
