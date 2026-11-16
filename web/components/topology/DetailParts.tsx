"use client";

import type { ReactNode, Ref } from "react";
import { formatRate } from "@/web/lib/rateFormat";
import { cn } from "@/web/lib/utils";
import { useSectionCollapse } from "./useSectionCollapse";
import { SectionIcon } from "./SectionIcon";

/**
 * A detail-panel section that folds to its title and a one-line summary (arrow or title
 * click), under a grey header strip with an icon that stays pinned while the section scrolls. Collapsed sections are remembered by `id` (default: the title without a
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
  const toggle = () => setCollapsed(!collapsed);
  return (
    <section ref={sectionRef} data-section={key} className="scroll-mt-0 border-t border-neutral-200 first:border-t-0">
      {/* Grey header strip, pinned to the top of the panel while its section scrolls. */}
      <div className="sticky top-0 z-[5] flex min-h-[2.5rem] items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-1.5">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={toggle}
          title={collapsed ? `Show ${title}` : `Minimise ${title}`}
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <SectionIcon id={key} />
          <h4 className="truncate text-[13px] font-semibold text-neutral-900 group-hover:text-blue-700">{title}</h4>
        </button>
        {!collapsed && actions}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? `Show ${title}` : `Minimise ${title}`}
          tabIndex={-1}
          className="-mr-1.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800"
        >
          <svg
            className={cn("transition-transform", collapsed && "-rotate-90")}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {collapsed
        ? summary != null && summary !== "" && <p className="truncate py-2 pl-[2.4375rem] pr-4 text-[11px] text-neutral-500">{summary}</p>
        : <div className="px-4 pb-3.5 pt-2.5">{plain ? children : <dl className={ROW_LIST}>{children}</dl>}</div>}
    </section>
  );
}

/*
 * Label / value lists in the detail panel. Narrow (as before): one column, label left, value
 * right. In a roomy panel (`data-roomy` on the panel, ≥ ROOMY_PANEL) they go two-up — three-up
 * when wide — and each value sits right after its label instead of across a wide gap.
 * Anything in the list that isn't a row (notes, warnings) spans the full width.
 */
export const ROW_LIST = cn(
  "space-y-1.5 text-xs [&>:not([data-row])]:col-span-full",
  "group-data-[roomy]/panel:grid group-data-[roomy]/panel:grid-cols-2 group-data-[roomy]/panel:gap-x-8 group-data-[roomy]/panel:gap-y-1.5 group-data-[roomy]/panel:space-y-0",
  "group-data-[wide]/panel:grid-cols-3"
);
export const ROW = "flex justify-between gap-3 group-data-[roomy]/panel:justify-start";
export const ROW_LABEL = "flex-shrink-0 text-neutral-500 group-data-[roomy]/panel:w-32 group-data-[roomy]/panel:flex-shrink";
export const ROW_VALUE = "min-w-0 break-words text-right font-medium text-neutral-800 group-data-[roomy]/panel:text-left";

export function DetailRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div data-row className={ROW}>
      <dt className={ROW_LABEL}>{label}</dt>
      <dd className={cn(ROW_VALUE, mono && "font-mono text-[11px]")}>{children}</dd>
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
