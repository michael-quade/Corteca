"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";
import { QUALITY_BG } from "./qualityStyles";
import { BACKHAUL_WIDTH, WIFI_DASH } from "./BackhaulEdge";

function LineSample({ className, dashed, width = BACKHAUL_WIDTH, dash = WIFI_DASH }: { className: string; dashed?: boolean; width?: number; dash?: string }) {
  return (
    <svg width="24" height="8" className="flex-shrink-0">
      <line x1="1" y1="4" x2="23" y2="4" strokeWidth={width} strokeLinecap={dashed ? "butt" : "round"} strokeDasharray={dashed ? dash : undefined} className={className} />
    </svg>
  );
}

const STORE = "corteca.legendOpen.v1";

function initialOpen(): boolean {
  try { return localStorage.getItem(STORE) !== "0"; } catch { return true; }
}

const Chevron = ({ d }: { d: string }) => (
  <svg className="flex-shrink-0 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d={d} /></svg>
);

const KeyIcon = () => (
  <svg className="flex-shrink-0 text-neutral-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <path d="M4 7h3M4 12h3M4 17h3M10 7h10M10 12h10M10 17h10" />
  </svg>
);

/**
 * The diagram key, top left: a one-line "Key" row when minimised (like the events rows under
 * it), the full key when open. Open / closed is remembered in this browser.
 */
export function TopologyLegend() {
  const [open, setOpenState] = useState(initialOpen);
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try { localStorage.setItem(STORE, v ? "1" : "0"); } catch { /* no storage */ }
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-left shadow-sm hover:bg-white"
      >
        <KeyIcon />
        <span className="text-xs font-semibold text-neutral-800">Key</span>
        <span className="text-[10px] text-neutral-500">· lines, clients, signal</span>
        <Chevron d="M9 6l6 6-6 6" />
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm">
      <div className="-mr-1.5 mb-1 flex items-center gap-2">
        <KeyIcon />
        <span className="text-xs font-semibold text-neutral-800">Key</span>
        <span className="flex-1" />
        <button
          type="button"
          aria-expanded
          aria-label="Minimise the key"
          title="Minimise the key"
          onClick={() => setOpen(false)}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 hover:bg-neutral-200"
        >
          <Chevron d="M15 6l-6 6 6 6" />
        </button>
      </div>
      <p className="mb-1 font-semibold text-neutral-700">Backhaul · solid = cable, dashed = WiFi</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5"><LineSample className="stroke-neutral-500" />Ethernet</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-amber-500" />Ethernet &lt; 1 Gbps</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-emerald-500" dashed />WiFi · Good</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-amber-500" dashed />WiFi · Fair</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-red-500" dashed />WiFi · Poor</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-blue-500" />Internet (WAN)</span>
      </div>
      <p className="mt-1 text-neutral-500">WiFi colour = Corteca rating</p>
      <p className="text-neutral-500">Moving dots = link has a rate (faster = higher)</p>
      <p className="mb-1 mt-2 font-semibold text-neutral-700">Clients</p>
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5"><LineSample className="stroke-neutral-500" width={2} />Wired</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-neutral-500" width={1.5} dashed dash="4 4" />WiFi</span>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-neutral-500">
        <span className="h-3 w-5 flex-shrink-0 rounded border-2 border-dashed border-neutral-300" />Switch (inferred from port data)
      </p>
      <p className="mb-1 mt-2 font-semibold text-neutral-700">Client signal</p>
      <div className="flex gap-3">
        {(["good", "fair", "poor"] as const).map((q) => (
          <span key={q} className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", QUALITY_BG[q])} />
            {q === "good" ? "≥ -65 dBm" : q === "fair" ? "-65 to -75" : "< -75"}
          </span>
        ))}
      </div>
    </div>
  );
}
