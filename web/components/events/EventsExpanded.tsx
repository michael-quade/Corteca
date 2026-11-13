"use client";

import { useEffect, useRef } from "react";
import { dateOnly } from "@/web/lib/eventFormat";
import { useEvents } from "./EventsContext";
import { EventsBody, downloadEventsCsv, useVisibleEvents } from "./EventsBody";
import { EventPeriodSwitch } from "./EventFilters";
import { IconButton, TodayPill } from "./EventsChrome";

/** The events drawer widened over the whole diagram, in the full card layout. Esc goes back to the drawer. */
export function EventsExpanded() {
  const ev = useEvents();
  const view = useVisibleEvents(ev);
  const ref = useRef<HTMLElement>(null);
  const expanded = ev?.drawer === "expanded";
  useEffect(() => { if (expanded) ref.current?.focus({ preventScroll: true }); }, [expanded]);
  if (!ev || !view || !expanded) return null;

  const from = ev.now - ev.period * 86_400_000;
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Network events"
      data-canvas-overlay
      onKeyDown={(e) => {
        // The canvas's own keys (arrows, Esc) stay off while this covers it.
        e.stopPropagation();
        if (e.key === "Escape") ev.setDrawer("open");
      }}
      className="absolute inset-3 z-20 flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg focus:outline-none"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3">
        <h3 className="text-base font-semibold text-neutral-900">Network events</h3>
        <TodayPill />
        <span className="text-xs text-neutral-500">Corteca activity log · {dateOnly(from)} – {dateOnly(ev.now)}</span>
        <span className="flex-1" />
        <EventPeriodSwitch value={ev.period} onChange={ev.setPeriod} />
        <button
          type="button"
          onClick={() => downloadEventsCsv(ev, view.visible)}
          disabled={!view.visible.length}
          className="rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
        >
          Download CSV
        </button>
        <button
          type="button"
          onClick={() => ev.setDrawer("open")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 4v6H4M14 20v-6h6M4 10l6-6M20 14l-6 6" />
          </svg>
          Back to drawer
        </button>
        <IconButton label="Collapse events" onClick={() => ev.setDrawer("closed")} muted>
          <path d="M15 6l-6 6 6 6" />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1">
        <EventsBody wide />
      </div>
    </section>
  );
}
