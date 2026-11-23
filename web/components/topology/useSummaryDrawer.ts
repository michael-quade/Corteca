"use client";

import { useCallback, useEffect, useState } from "react";
import type { Selection } from "@/web/lib/topologySelection";

/** Network summary drawer width while nothing is selected. */
export const SUMMARY_W = 300;
/** Height of its one-line folded row (the detail panel opens below it). */
export const SUMMARY_ROW_H = 38;

export interface SummaryDrawerState {
  /** Drawn open (otherwise the one-line row). */
  open: boolean;
  /** Open over the detail panel (the user clicked the row while something is selected). */
  overPanel: boolean;
  /** Row click / fold arrow. */
  toggle: () => void;
}

/**
 * The Network summary drawer, top right of the diagram. Open when a network opens; selecting
 * something folds it to its row with the detail panel below, and closing the panel opens it
 * again — unless the user folded it themselves with nothing selected. With a panel open, the
 * row opens the summary over the panel until the selection changes or the arrow folds it.
 * `onUserToggle` runs when the user opens / folds it with nothing selected (the diagram refits).
 */
export function useSummaryDrawer(selection: Selection | null, onUserToggle: () => void): SummaryDrawerState {
  const [userFolded, setUserFolded] = useState(false);
  const [peek, setPeek] = useState(false);
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;

  // Another selection (or none) folds a summary opened over the panel.
  useEffect(() => { setPeek(false); }, [selKey]);

  const toggle = useCallback(() => {
    if (selKey) { setPeek((p) => !p); return; }
    setUserFolded((f) => !f);
    onUserToggle();
  }, [selKey, onUserToggle]);

  const open = selKey ? peek : !userFolded;
  return { open, overPanel: !!selKey && peek, toggle };
}
