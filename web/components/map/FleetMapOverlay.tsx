"use client";

import { MapZoomButtons } from "./MapZoomButtons";

function Dot({ className }: { className: string }) {
  return <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ring-2 ring-white ${className}`} />;
}

/** Legend (top left) and zoom buttons (top right) over the fleet map, styled like the topology canvas. */
export function FleetMapOverlay({ count, onZoomIn, onZoomOut, onFit }: {
  count: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] text-neutral-600 shadow-sm">
        <p className="mb-1 font-semibold text-neutral-700">{count.toLocaleString()} networks located</p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><Dot className="bg-emerald-500" />Online</span>
          <span className="flex items-center gap-1.5"><Dot className="bg-red-500" />Offline</span>
          <span className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-emerald-500 bg-white text-[7px] font-bold text-neutral-800">3</span>
            Group (red ring if any offline)
          </span>
        </div>
      </div>
      <MapZoomButtons onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} fitLabel="Show all networks" />
    </>
  );
}
