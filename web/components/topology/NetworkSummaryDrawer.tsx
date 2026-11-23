"use client";

import { useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { summariseNetwork } from "@/web/lib/networkSummary";
import type { ClientFilters } from "@/web/lib/topologySelection";
import { NetworkSummaryBody } from "./NetworkSummaryBody";
import { PANEL_GAP } from "./useDetailPanel";
import { SUMMARY_ROW_H, SUMMARY_W, type SummaryDrawerState } from "./useSummaryDrawer";

// Room left for the minimap (bottom right) under the open drawer while nothing is selected.
const MINIMAP_ROOM = 175;

const SummaryIcon = () => (
  <svg className="flex-shrink-0 text-blue-600" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h6M7 17h8" />
  </svg>
);

/**
 * Network summary, top right of the diagram under the toolbar (see useSummaryDrawer for when it
 * opens and folds). Folded it is a one-line row; with a detail panel open the row takes the
 * panel's width and the panel sits below it.
 */
export function NetworkSummaryDrawer({ network, state, panelWidth, filters, onFiltersChange }: {
  network: McpNetwork;
  state: SummaryDrawerState;
  /** The detail panel's width while one is open, else null. */
  panelWidth: number | null;
  filters: ClientFilters;
  onFiltersChange: (f: ClientFilters) => void;
}) {
  const summary = useMemo(() => summariseNetwork(network), [network]);
  const { open, overPanel, toggle } = state;
  const width = panelWidth ?? SUMMARY_W;
  const maxHeight = open
    ? `calc(100% - ${2 * PANEL_GAP + (panelWidth == null ? MINIMAP_ROOM : 0)}px)`
    : undefined;
  const line = `${summary.aps.total} AP${summary.aps.total === 1 ? "" : "s"} · ${summary.clients.total} client${summary.clients.total === 1 ? "" : "s"}`;

  return (
    <section
      aria-label="Network summary"
      style={{ top: PANEL_GAP, right: PANEL_GAP, width, maxHeight }}
      className={cn(
        "absolute flex max-w-[calc(100%-1.5rem)] flex-col rounded-xl border border-neutral-200 bg-white shadow-lg",
        overPanel ? "z-[15]" : "z-10"
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        title={open ? "Minimise the network summary" : "Show the network summary"}
        style={{ minHeight: SUMMARY_ROW_H }}
        className={cn("flex w-full flex-shrink-0 items-center gap-2 rounded-xl px-3.5 text-left hover:bg-neutral-50", open && "rounded-b-none")}
      >
        <SummaryIcon />
        <span className="text-sm font-semibold text-neutral-900">Network summary</span>
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">{!open && `· ${line}`}</span>
        <svg
          className={cn("h-4 w-4 flex-shrink-0 text-neutral-500 transition-transform", !open && "-rotate-90")}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="min-h-0 overflow-y-auto">
          <NetworkSummaryBody summary={summary} capturedAt={network.capturedAt} filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      )}
    </section>
  );
}
