"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/web/lib/utils";

type Side = "left" | "right";

/**
 * Drag-to-resize for a drawer / panel width. `side` = the edge the grip sits on: a grip on
 * the right edge grows the box when dragged right, one on the left edge when dragged left.
 * `max` is read when a drag starts (it depends on the canvas width). While dragging,
 * `width` follows the pointer; `onCommit` stores the result once on release.
 */
export function useResizeDrag({ side, width, min, max, onCommit }: {
  side: Side;
  width: number;
  min: number;
  max: () => number;
  onCommit: (w: number) => void;
}) {
  const [dragW, setDragW] = useState<number | null>(null);
  const drag = useRef<{ x: number; w: number; max: number } | null>(null);
  const dir = side === "right" ? 1 : -1;
  const live = Math.max(min, dragW ?? width);

  const gripProps = {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, w: live, max: max() };
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const d = drag.current;
      if (d) setDragW(Math.min(d.max, Math.max(min, d.w + dir * (e.clientX - d.x))));
    },
    onPointerUp: () => {
      if (drag.current && dragW != null) onCommit(dragW);
      drag.current = null;
      setDragW(null);
    },
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      const step = e.key === "ArrowRight" ? 20 * dir : e.key === "ArrowLeft" ? -20 * dir : 0;
      if (!step) return;
      e.preventDefault();
      e.stopPropagation();
      onCommit(Math.min(max(), Math.max(min, live + step)));
    },
  };
  return { width: live, dragging: dragW != null, gripProps };
}

/** The grip on a resizable drawer / panel edge (two hairlines in a small white tab). */
export function ResizeGrip({ side, label, width, dragging, gripProps, onReset }: {
  side: Side;
  label: string;
  width: number;
  dragging: boolean;
  gripProps: ReturnType<typeof useResizeDrag>["gripProps"];
  /** Double-click: back to the default width. */
  onReset?: () => void;
}) {
  return (
    <button
      type="button"
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(width)}
      title={onReset ? `${label} (double-click: default width)` : label}
      {...gripProps}
      onPointerCancel={gripProps.onPointerUp}
      onDoubleClick={onReset}
      className={cn(
        "absolute top-1/2 z-20 flex h-12 w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center gap-0.5 rounded-md border border-neutral-300 bg-white shadow-sm hover:border-blue-600",
        side === "right" ? "-right-1.5" : "-left-1.5",
        dragging && "border-blue-600"
      )}
    >
      <span className="h-6 w-px bg-neutral-400" /><span className="h-6 w-px bg-neutral-400" />
    </button>
  );
}
