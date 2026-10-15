"use client";

import { useReactFlow } from "@xyflow/react";

const BTN = "flex h-8 w-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900";

/** Zoom in / out / fit, shown beside the legend at the top of the canvas. */
export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div role="group" aria-label="Zoom" className="flex flex-col divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button type="button" onClick={() => zoomIn({ duration: 200 })} aria-label="Zoom in" title="Zoom in" className={BTN}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <button type="button" onClick={() => zoomOut({ duration: 200 })} aria-label="Zoom out" title="Zoom out" className={BTN}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <button type="button" onClick={() => fitView({ padding: 0.15, duration: 300 })} aria-label="Fit to screen" title="Fit to screen" className={BTN}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </div>
  );
}
