"use client";

import { cn } from "@/web/lib/utils";
import { QUALITY_BG } from "./qualityStyles";

function LineSample({ className, dashed, width = 3 }: { className: string; dashed?: boolean; width?: number }) {
  return (
    <svg width="24" height="8" className="flex-shrink-0">
      <line x1="1" y1="4" x2="23" y2="4" strokeWidth={width} strokeLinecap="round" strokeDasharray={dashed ? "5 4" : undefined} className={className} />
    </svg>
  );
}

export function TopologyLegend() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm">
      <p className="mb-1 font-semibold text-neutral-700">Backhaul (Corteca rating)</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5"><LineSample className="stroke-emerald-500" />Good</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-amber-500" />Fair</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-red-500" dashed width={2} />Poor</span>
        <span className="flex items-center gap-1.5"><LineSample className="stroke-neutral-500" />Ethernet</span>
        <span className="col-span-2 flex items-center gap-1.5"><LineSample className="stroke-amber-500" />Ethernet below 1 Gbps</span>
      </div>
      <p className="mt-1.5 text-neutral-500">Line width = data rate</p>
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
