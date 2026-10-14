"use client";

import { useCallback, useEffect, useState } from "react";
import { EMPTY_FILTERS, parseViewState, serializeViewState, type ViewState } from "@/web/lib/topologySelection";

const DEFAULT_VIEW: ViewState = { network: null, selection: null, filters: EMPTY_FILTERS, layout: "tree", viewport: null };

/**
 * Visualizer view state mirrored into the query string with history.replaceState,
 * so a view can be shared as a link. Read after mount (not during render) so the
 * statically prerendered page hydrates without a mismatch.
 */
export function useTopologyViewState() {
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setView(parseViewState(window.location.search));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const next = `${window.location.pathname}${serializeViewState(view)}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [view, ready]);

  const update = useCallback((patch: Partial<ViewState>) => setView((v) => ({ ...v, ...patch })), []);

  return { view, update, ready };
}
