"use client";

import { createContext, useCallback, useContext, useEffect, useState, type RefObject } from "react";

/** Today's fixed width: the gateway's six section chips need it. */
export const PANEL_MIN = 480;
/** Gap between the panel and the canvas edges — the same as the events drawer (React Flow's Panel margin). */
export const PANEL_GAP = 15;
/** From this width label / value lists go two-up and list rows go on one line. */
export const ROOMY_PANEL = 600;
/** From this width (in practice: expanded over the diagram) label / value lists go three-up. */
export const WIDE_PANEL = 1000;
const STORE = "corteca.detailPanel.v1";

/** Half the canvas at most, like the events drawer. */
export function panelMax(canvasW: number): number {
  return Math.max(PANEL_MIN, Math.floor((canvasW || 1200) / 2));
}

function storedWidth(): number {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (v && typeof v === "object" && Number(v.width) >= PANEL_MIN) return Number(v.width);
  } catch { /* no storage */ }
  return PANEL_MIN;
}

export interface DetailPanelState {
  /** The width the panel draws at: the stored width within [PANEL_MIN, half the canvas]. */
  width: number;
  max: () => number;
  setWidth: (w: number) => void;
  /** Covering the whole diagram (⤢); Esc / "Back to panel" returns. Not remembered. */
  expanded: boolean;
  setExpanded: (on: boolean) => void;
}

/**
 * The detail panel's size: one width for every panel kind (AP, client, link, switch, WAN),
 * remembered in localStorage, and whether it is expanded over the diagram.
 */
export function useDetailPanel(flowRef: RefObject<HTMLDivElement | null>, open: boolean): DetailPanelState {
  const [stored, setStored] = useState(PANEL_MIN);
  const [canvasW, setCanvasW] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setStored(storedWidth()); }, []);
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return;
    setCanvasW(el.clientWidth);
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [flowRef]);
  // Closing the panel ends the expanded view.
  useEffect(() => { if (!open) setExpanded(false); }, [open]);

  const setWidth = useCallback((w: number) => {
    const v = Math.max(PANEL_MIN, Math.round(w));
    setStored(v);
    try { localStorage.setItem(STORE, JSON.stringify({ width: v })); } catch { /* no storage */ }
  }, []);
  const max = useCallback(() => panelMax(flowRef.current?.clientWidth ?? canvasW), [flowRef, canvasW]);

  return { width: Math.min(stored, panelMax(canvasW)), max, setWidth, expanded, setExpanded };
}

/** How roomy the panel content is laid out (also set as `data-roomy` / `data-wide` on the panel for CSS). */
export interface PanelLayout { roomy: boolean; wide: boolean }
export const PanelLayoutContext = createContext<PanelLayout>({ roomy: false, wide: false });
export const usePanelLayout = () => useContext(PanelLayoutContext);
