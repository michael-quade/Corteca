"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Gap between the anchor and the tip, and the least distance the tip keeps from the window edge. */
const GAP = 6;
const EDGE = 8;

/** Viewport coordinates (getBoundingClientRect) of what the tip points at: an element or a point. */
export interface TipAnchor { left: number; top: number; right: number; bottom: number }

export const pointAnchor = (x: number, y: number): TipAnchor => ({ left: x, right: x, top: y, bottom: y });

/**
 * A hover tip drawn at page level (into the fullscreen element while something is full screen),
 * so a drawer, panel or scroll area with `overflow` can't cut it off. Centred on the anchor,
 * shifted to stay inside the window, on the preferred side (`below` / `above`) or the other one
 * when there's no room; `arrow` adds a pointer at the anchor. Purely visual (`aria-hidden`):
 * give the control its own label. `onScrollAway` is called when anything scrolls, since the
 * anchor moves away from a fixed tip.
 */
export function FloatingTip({ anchor, placement = "below", arrow, className, onScrollAway, children }: {
  anchor: TipAnchor;
  placement?: "below" | "above";
  arrow?: boolean;
  /** Colours, padding, width — position is set here. */
  className?: string;
  onScrollAway?: () => void;
  children: ReactNode;
}) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; arrowX: number } | null>(null);
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => setTarget(document.fullscreenElement ?? document.body), []);

  const { left: aL, top: aT, right: aR, bottom: aB } = anchor;
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip) return;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const cx = (aL + aR) / 2;
    const left = Math.min(Math.max(cx - w / 2, EDGE), Math.max(window.innerWidth - w - EDGE, EDGE));
    const roomBelow = aB + GAP + h <= window.innerHeight - EDGE;
    const roomAbove = aT - GAP - h >= EDGE;
    const above = placement === "above" ? roomAbove || !roomBelow : !roomBelow && roomAbove;
    setPos({ left, top: above ? aT - GAP - h : aB + GAP, above, arrowX: Math.min(Math.max(cx - left - 4, 8), w - 16) });
  }, [aL, aT, aR, aB, placement, target, children]);

  const scrollAway = useRef(onScrollAway);
  scrollAway.current = onScrollAway;
  useEffect(() => {
    const onScroll = () => scrollAway.current?.();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, []);

  if (!target) return null;
  return createPortal(
    <div
      ref={tipRef}
      aria-hidden
      style={{ position: "fixed", left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
      className={`pointer-events-none z-[1000] ${className ?? ""}`}
    >
      {arrow && pos && (
        <span
          className={`absolute h-2 w-2 rotate-45 bg-inherit ${pos.above ? "-bottom-1" : "-top-1"}`}
          style={{ left: pos.arrowX }}
        />
      )}
      {children}
    </div>,
    target,
  );
}
