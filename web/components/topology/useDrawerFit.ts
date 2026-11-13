"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReactFlow, type FitViewOptions } from "@xyflow/react";
import { DRAWER_MIN, useEvents, type DrawerMode } from "@/web/components/events/EventsContext";
import { useTdsEvents } from "@/web/components/tds-events/TdsEventsContext";

/** A drawer up to this share of the canvas width leaves the diagram enough room beside it. */
export const DRAWER_FIT_SHARE = 0.4;
const PANEL_MARGIN = 15; // React Flow's Panel offset from the canvas edge
const GAP = 24;
const EDGE = "6%"; // about the old `padding: 0.15` per side

/**
 * Fitting the diagram around the events drawers (standard and TDS), which sit over the
 * canvas's left side. While a drawer is open at a comfortable width (≤ DRAWER_FIT_SHARE of
 * the canvas, e.g. its default), the diagram is fitted into the area to its right; a drawer
 * stretched wider is left to cover the diagram. The view moves by itself only when a drawer
 * opens, closes or is resized to a comfortable width — never for a drawer stretched wide
 * or expanded over the canvas. `fit()` (the Fit button, layout switches) uses the same area.
 */
export function useDrawerFit(flowRef: RefObject<HTMLDivElement | null>, ready: boolean, onAutoFit: () => void) {
  const ev = useEvents();
  const tds = useTdsEvents();
  const { fitView } = useReactFlow();
  const [canvasW, setCanvasW] = useState(0);

  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    setCanvasW(el.clientWidth);
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [flowRef]);

  // One drawer at a time (opening one closes the other).
  const mode: DrawerMode = ev?.drawer === "open" || tds?.drawer === "open" ? "open"
    : ev?.drawer === "expanded" || tds?.drawer === "expanded" ? "expanded" : "closed";
  const stored = ev?.drawer === "open" ? ev.width : tds?.drawer === "open" ? tds.width : null;
  // As the drawer draws itself: at least DRAWER_MIN, at most half the canvas.
  const width = stored == null ? null : Math.max(DRAWER_MIN, canvasW ? Math.min(stored, Math.floor(canvasW / 2)) : stored);
  const comfortable = width != null && (!canvasW || width <= canvasW * DRAWER_FIT_SHARE);

  const options = useMemo<FitViewOptions>(() => ({
    padding: { top: EDGE, right: EDGE, bottom: EDGE, left: mode === "open" && comfortable && width != null ? `${PANEL_MARGIN + width + GAP}px` : EDGE },
  }), [mode, comfortable, width]);

  const fit = useCallback((duration = 300) => { void fitView({ ...options, duration }); }, [fitView, options]);

  const prev = useRef({ mode, width });
  useEffect(() => {
    const p = prev.current;
    prev.current = { mode, width };
    if (!ready) return;
    const closed = mode === "closed" && p.mode !== "closed";
    const openedOrResized = mode === "open" && comfortable && (p.mode !== "open" || p.width !== width);
    if (!closed && !openedOrResized) return;
    onAutoFit();
    requestAnimationFrame(() => fit(400));
  }, [mode, width, comfortable, ready, fit, onAutoFit]);

  return { options, fit };
}

/**
 * The canvas's fitting: useDrawerFit plus whether the user has panned / zoomed since the last
 * fit, so data arriving later can refit only an untouched view. A view restored from the URL
 * doesn't count: it is saved after every move, automatic fits included (a tab restored after
 * a reload would otherwise keep a view fitted before the gateway's data widened the diagram).
 * `fitRef.current(duration)` fits (drawer-aware) and marks the view untouched again.
 */
export function useCanvasFit(flowRef: RefObject<HTMLDivElement | null>, ready: boolean, forgetRestore: () => void) {
  const userMoved = useRef(false);
  const onAutoFit = useCallback(() => { forgetRestore(); userMoved.current = false; }, [forgetRestore]);
  const { options, fit } = useDrawerFit(flowRef, ready, onAutoFit);
  const fitRef = useRef<(duration?: number) => void>(() => {});
  fitRef.current = (duration) => { onAutoFit(); fit(duration); };
  return { options, fitRef, userMoved };
}
