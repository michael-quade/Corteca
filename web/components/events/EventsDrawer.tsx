"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/web/lib/utils";
import { DRAWER_MIN, useEvents } from "./EventsContext";
import { EventsBody, downloadEventsCsv, useVisibleEvents } from "./EventsBody";
import { EventPeriodSwitch } from "./EventFilters";
import { EventsIcon, IconButton, TodayPill } from "./EventsChrome";

/** Half the diagram at most, so the canvas stays usable beside it. */
function maxWidth(el: HTMLElement | null): number {
  const canvas = el?.closest(".react-flow") as HTMLElement | null;
  return Math.max(DRAWER_MIN, Math.floor((canvas?.clientWidth ?? 1200) / 2));
}

/**
 * Network events under the diagram legend: a one-line row when collapsed, a resizable
 * drawer when open. Rendered inside the canvas's top-left panel.
 */
export function EventsDrawer() {
  const ev = useEvents();
  const view = useVisibleEvents(ev);
  const ref = useRef<HTMLElement>(null);
  const [dragW, setDragW] = useState<number | null>(null);
  const drag = useRef<{ x: number; w: number; max: number } | null>(null);
  if (!ev || !view) return null;

  if (ev.drawer !== "open") {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => ev.setDrawer("open")}
        data-canvas-overlay
        className="pointer-events-auto flex items-center gap-2 self-stretch rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-left shadow-sm hover:bg-white"
      >
        <EventsIcon />
        <span className="text-xs font-semibold text-neutral-800">Network events</span>
        <TodayPill />
        {ev.load === "ready" && <span className="text-[10px] text-neutral-500">· {ev.items.filter((i) => i.kind !== "routine" && ev.categories.has(i.category)).length} in 30 days</span>}
        {ev.load === "loading" && <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />}
        <svg className="ml-auto flex-shrink-0 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
      </button>
    );
  }

  const width = Math.max(DRAWER_MIN, dragW ?? Math.min(ev.width, maxWidth(ref.current)));

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: width, max: maxWidth(ref.current) };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (d) setDragW(Math.min(d.max, Math.max(DRAWER_MIN, d.w + e.clientX - d.x)));
  };
  const onPointerUp = () => {
    if (drag.current && dragW != null) ev.setWidth(dragW);
    drag.current = null;
    setDragW(null);
  };
  const onHandleKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0;
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    ev.setWidth(Math.min(maxWidth(ref.current), Math.max(DRAWER_MIN, width + step)));
  };

  return (
    <section
      ref={ref}
      aria-label="Network events"
      data-canvas-overlay
      style={{ width }}
      className="nowheel nopan pointer-events-auto relative flex min-h-0 flex-1 flex-col rounded-xl border border-neutral-200 bg-white shadow-lg"
    >
      <header className="flex items-center gap-1.5 border-b border-neutral-100 py-2 pl-3.5 pr-2">
        <h3 className="text-sm font-semibold text-neutral-900">Network events</h3>
        <TodayPill />
        <span className="flex-1" />
        <IconButton label="Expand over the diagram" onClick={() => ev.setDrawer("expanded")}>
          <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
        </IconButton>
        <IconButton label="Download CSV" onClick={() => downloadEventsCsv(ev, view.visible)} disabled={!view.visible.length}>
          <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
        </IconButton>
        <IconButton label="Collapse events" onClick={() => ev.setDrawer("closed")} muted>
          <path d="M15 6l-6 6 6 6" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1">
        <EventsBody lead={<EventPeriodSwitch value={ev.period} onChange={ev.setPeriod} small />} />
      </div>
      <button
        type="button"
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize the events drawer"
        aria-valuenow={width}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onHandleKey}
        className={cn(
          "absolute -right-1.5 top-1/2 flex h-12 w-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center gap-0.5 rounded-md border border-neutral-300 bg-white shadow-sm hover:border-blue-600",
          dragW != null && "border-blue-600"
        )}
      >
        <span className="h-6 w-px bg-neutral-400" /><span className="h-6 w-px bg-neutral-400" />
      </button>
    </section>
  );
}
