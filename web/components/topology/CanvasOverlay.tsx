"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Lets a detail-panel section (the gateway's location map) take over the diagram area:
// its content is portalled over the canvas, left of the detail panel.

export interface CanvasOverlay {
  /** The diagram area the overlay is drawn over. */
  target: HTMLElement | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const CanvasOverlayContext = createContext<CanvasOverlay | null>(null);

/** null outside the topology canvas (expansion then isn't offered). */
export const useCanvasOverlay = () => useContext(CanvasOverlayContext);

/** State for the canvas: the overlay value and the element to set as its target. */
export function useCanvasOverlayState() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const value = useMemo<CanvasOverlay>(() => ({ target, open, setOpen }), [target, open]);
  return { value, setTarget };
}

/**
 * The overlay frame: covers the diagram (keeping the detail panel visible on wide screens),
 * with a title bar and ×; Esc closes it. While it's open the canvas ignores its own keys.
 */
export function CanvasOverlayFrame({ title, kicker, onClose, children }: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const overlay = useCanvasOverlay();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!overlay?.target) return null;

  return createPortal(
    // The ground covers the whole diagram, so nothing shows between the map and the panel.
    <div data-canvas-overlay role="dialog" aria-label={`${kicker}: ${title}`} className="absolute inset-0 z-[9] bg-neutral-50">
    <div className="absolute bottom-3 left-3 right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg lg:right-[calc(25rem+1.5rem)]">
      <header className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{kicker}</p>
          <h3 className="truncate text-sm font-semibold text-neutral-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-neutral-400 sm:inline">Esc to return to the diagram</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            title="Back to the diagram (Esc)"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
    </div>,
    overlay.target,
  );
}
