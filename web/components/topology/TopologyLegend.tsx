"use client";

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

export function TopologyLegend() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm">
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
