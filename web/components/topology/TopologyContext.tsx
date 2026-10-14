"use client";

import { createContext, useContext } from "react";
import { Position } from "@xyflow/react";
import type { LayoutMode } from "@/web/lib/topologyFlow";
import type { ClientFilters, Highlight, Selection } from "@/web/lib/topologySelection";

// Interaction state read by node/edge components. Kept out of node data so a
// selection or filter change re-renders nodes without re-running ELK.
export interface TopologyUi {
  selection: Selection | null;
  highlight: Highlight | null;
  filters: ClientFilters;
  layout: LayoutMode;
  /** false when a client filter is active and this client doesn't match it */
  clientVisible: (clientId: string) => boolean;
  select: (sel: Selection | null) => void;
}

export const TopologyUiContext = createContext<TopologyUi | null>(null);

export function useTopologyUi(): TopologyUi {
  const ui = useContext(TopologyUiContext);
  if (!ui) throw new Error("useTopologyUi must be used inside TopologyUiContext");
  return ui;
}

export const isSelected = (ui: TopologyUi, kind: Selection["kind"], id: string) =>
  ui.selection?.kind === kind && ui.selection.id === id;

// Where edges attach for each layout. Radial uses centred handles + straight
// edges, so links run node-centre to node-centre underneath the cards.
const CENTRED = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as const;
export function handleLayout(layout: LayoutMode) {
  if (layout === "horizontal") return { target: Position.Left, source: Position.Right, style: undefined };
  if (layout === "radial") return { target: Position.Top, source: Position.Bottom, style: CENTRED };
  return { target: Position.Top, source: Position.Bottom, style: undefined };
}

export const HIDDEN_HANDLE = "!h-1 !w-1 !min-w-0 !border-0 !bg-transparent";
