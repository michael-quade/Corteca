"use client";

import type { KeyboardEvent, MouseEvent, RefObject } from "react";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { navigationOrder, type Selection } from "@/web/lib/topologySelection";

/**
 * Keyboard for the topology canvas: arrow keys step through APs and their clients
 * in tree order, Esc clears the selection. A click inside the canvas moves focus to
 * the canvas wrapper, since clicked edge labels / cards don't keep it (it fell back
 * to <body>, and Esc then did nothing).
 */
export function useCanvasKeyboard(
  wrapperRef: RefObject<HTMLDivElement | null>,
  network: McpNetwork,
  selection: Selection | null,
  onSelect: (sel: Selection | null) => void,
) {
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { onSelect(null); return; }
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || (e.target as HTMLElement).closest("input, textarea, select")) return;
    e.preventDefault();
    const order = navigationOrder(network);
    if (!order.length) return;
    const i = selection ? order.findIndex((s) => s.kind === selection.kind && s.id === selection.id) : -1;
    const next = i < 0 ? (step > 0 ? 0 : order.length - 1) : (i + step + order.length) % order.length;
    onSelect(order.at(next) ?? null);
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("input, textarea, select, [role='dialog'], [data-canvas-overlay]")) return;
    wrapperRef.current?.focus({ preventScroll: true });
  }

  return { onKeyDown, onClick };
}
