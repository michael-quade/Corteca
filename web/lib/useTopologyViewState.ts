"use client";

import { useCallback, useEffect, useState } from "react";
import { serializeViewState, type ViewState } from "@/web/lib/topologySelection";

/**
 * One open network's view state (selection, filters, layout, zoom). The tab on
 * screen mirrors it into the query string with history.replaceState, so a view can
 * be shared as a link; tabs in the background keep theirs in memory.
 */
export function useTopologyViewState(initial: ViewState, active: boolean) {
  const [view, setView] = useState<ViewState>(initial);

  useEffect(() => {
    if (!active) return;
    const next = `${window.location.pathname}${serializeViewState(view)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [view, active]);

  const update = useCallback((patch: Partial<ViewState>) => setView((v) => ({ ...v, ...patch })), []);

  return { view, update };
}
