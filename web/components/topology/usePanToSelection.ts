"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useReactFlow } from "@xyflow/react";
import { anchorNodeId, type Selection, type Viewport } from "@/web/lib/topologySelection";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { FlowNode } from "@/web/lib/topologyFlow";

/** Space kept between the selected node and the panel / canvas edges. */
const MARGIN = 24;
/** A node panned into view is shown at least this zoom. */
const MIN_ZOOM = 0.8;

interface Box { x: number; y: number; w: number; h: number }

/** The node's box on screen in view `v`. */
function onScreen(n: Box, v: Viewport) {
  return { left: n.x * v.zoom + v.x, top: n.y * v.zoom + v.y, right: (n.x + n.w) * v.zoom + v.x, bottom: (n.y + n.h) * v.zoom + v.y };
}

/** Shift `pos` the least so [lo, hi] fits in [min, max]; the start edge wins when it can't. */
function nudge(lo: number, hi: number, min: number, max: number): number {
  if (hi > max) return Math.max(max - hi, min - lo);
  if (lo < min) return min - lo;
  return 0;
}

/**
 * Keeps the selected node visible beside the detail panel, moving the diagram as little as
 * possible: a hidden node is slid just clear of the panel (not centred, which left a wide gap
 * between the diagram and the panel). When the panel is resized the diagram follows its edge —
 * wider pushes it left, narrower lets it slide back towards where it was before the panel opened.
 * Closing the panel restores that view (unless the user moved it meanwhile: `restoreView` is then null).
 */
export function usePanToSelection(opts: {
  flowRef: RefObject<HTMLDivElement | null>;
  restoreView: { current: Viewport | null };
  network: McpNetwork;
  selection: Selection | null;
  nodes: FlowNode[] | null;
  panelW: number;
  panelExpanded: boolean;
}) {
  const { flowRef, restoreView, network, selection, nodes, panelW, panelExpanded } = opts;
  const { getViewport, setViewport, getNode } = useReactFlow();
  const lastPanelW = useRef(panelW);
  // Where the diagram sits for this selection (before any panel-resize push) and the view this
  // hook last set — a different current view means the user moved it, which becomes the new home.
  const home = useRef<Viewport | null>(null);
  const lastSet = useRef<Viewport | null>(null);

  useEffect(() => {
    const resized = lastPanelW.current !== panelW;
    lastPanelW.current = panelW;
    if (!selection || !nodes || panelExpanded) return;
    const id = anchorNodeId(network, selection);
    const node = id ? getNode(id) : undefined;
    const box = flowRef.current?.getBoundingClientRect();
    if (!node || !box) return;
    const n: Box = { x: node.position.x, y: node.position.y, w: node.width ?? 0, h: node.height ?? 0 };
    const maxRight = box.width - panelW - MARGIN;
    const cur = getViewport();
    const s = onScreen(n, cur);
    const fits = s.left >= 0 && s.top >= 0 && s.right <= box.width - panelW && s.bottom <= box.height;

    if (resized) {
      // Follow the panel's edge: push left if it now covers the node, else slide back
      // towards this selection's home view as far as the node still stays clear.
      const l = lastSet.current;
      if (!home.current || !l || l.x !== cur.x || l.y !== cur.y || l.zoom !== cur.zoom) home.current = cur;
      const base = home.current;
      let dx = nudge(s.left, s.right, MARGIN, maxRight);
      if (dx === 0 && base.zoom === cur.zoom && base.x > cur.x) dx = Math.max(0, Math.min(base.x - cur.x, maxRight - s.right));
      const v = { ...cur, x: cur.x + dx };
      lastSet.current = v;
      if (dx !== 0) void setViewport(v, { duration: 0 });
      return;
    }
    if (fits) { home.current = lastSet.current = cur; return; }

    restoreView.current ??= cur;
    // Zoom (around the node's centre) only if it is too small to read, then slide it just into view.
    const zoom = Math.max(cur.zoom, MIN_ZOOM);
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    let v: Viewport = {
      zoom,
      x: cx * cur.zoom + cur.x - cx * zoom,
      y: cy * cur.zoom + cur.y - cy * zoom,
    };
    const t = onScreen(n, v);
    v = { ...v, x: v.x + nudge(t.left, t.right, MARGIN, maxRight), y: v.y + nudge(t.top, t.bottom, MARGIN, box.height - MARGIN) };
    home.current = lastSet.current = v;
    void setViewport(v, { duration: 400 });
  }, [selection, nodes, network, getNode, getViewport, setViewport, panelW, panelExpanded, flowRef, restoreView]);

  // Panel closed → put the diagram back where it was before the panel moved it.
  useEffect(() => {
    if (selection || !restoreView.current) return;
    void setViewport(restoreView.current, { duration: 400 });
    restoreView.current = null;
  }, [selection, setViewport, restoreView]);
}
