"use client";

import { useMemo, useState } from "react";
import { categoryCounts, dayBuckets, inPeriod, scopeItems, summarise } from "@/web/lib/eventStats";
import { downloadText, eventsCsv } from "@/web/lib/eventFormat";
import { Notice } from "@/web/components/corteca/Notice";
import { useEvents, type EventsUi } from "./EventsContext";
import { EventSummaryTiles } from "./EventSummaryTiles";
import { EventDayBars } from "./EventDayBars";
import { EventFilters } from "./EventFilters";
import { EventList } from "./EventList";

/** The rows on screen for the current period / device / chips, plus what the filters need. */
export function useVisibleEvents(ev: EventsUi | null) {
  return useMemo(() => {
    if (!ev) return null;
    const base = { period: ev.period, device: ev.device };
    const scoped = scopeItems(ev.items, { ...base, routine: ev.routine }, ev.now);
    const visible = scoped.filter((it) => ev.categories.has(it.category));
    const routineCount = ev.items.filter((it) => it.kind === "routine" && inPeriod(it, ev.now, ev.period) && (!ev.device || it.device === ev.device)).length;
    // Picker: APs first, then other devices with events in the period.
    const seen = new Set(scopeItems(ev.items, { period: ev.period, device: null, routine: true }, ev.now).map((it) => it.device).filter((d): d is string => !!d));
    if (ev.device) seen.add(ev.device);
    const devices = [...seen].sort((a, b) => Number(ev.names.selection(b)?.kind === "ap") - Number(ev.names.selection(a)?.kind === "ap") || ev.names.label(a).localeCompare(ev.names.label(b)));
    return { scoped, visible, counts: categoryCounts(scoped), routineCount, devices };
  }, [ev]);
}

export function downloadEventsCsv(ev: EventsUi, items: Parameters<typeof eventsCsv>[0]) {
  const day = new Date(ev.now).toISOString().slice(0, 10);
  downloadText(eventsCsv(items, ev.names.label), `network-events-${ev.networkId}-${day}.csv`);
}

/** Tiles, day bars, filters and the list: shared by the drawer and its expanded view. */
export function EventsBody({ wide }: { wide?: boolean }) {
  const ev = useEvents();
  const view = useVisibleEvents(ev);
  const [jump, setJump] = useState<{ day: number; n: number } | null>(null);
  const summary = useMemo(() => (ev && view ? summarise(view.scoped, ev.now) : null), [ev, view]);
  const buckets = useMemo(() => (ev && view ? dayBuckets(view.visible, ev.now, ev.period) : []), [ev, view]);
  if (!ev || !view || !summary) return null;

  if (ev.load === "idle" || ev.load === "loading") {
    return (
      <p className="flex items-center gap-2 py-4 text-xs text-neutral-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
        Reading Corteca&apos;s activity log…
      </p>
    );
  }
  if (ev.load === "error") {
    return (
      <Notice tone="error" title="Couldn't read the activity log">
        {ev.error}{" "}
        <button type="button" onClick={ev.retry} className="font-medium text-blue-600 underline-offset-2 hover:underline">Try again</button>
      </Notice>
    );
  }

  return (
    <div className={wide ? "space-y-4" : "space-y-3"}>
      <EventSummaryTiles summary={summary} wide={wide} />
      <EventDayBars buckets={buckets} wide={wide} onPick={(day) => setJump((j) => ({ day, n: (j?.n ?? 0) + 1 }))} />
      <div className="border-t border-neutral-100 pt-3">
        <EventFilters counts={view.counts} devices={view.devices} routineCount={view.routineCount} wide={wide} />
      </div>
      <EventList items={view.visible} wide={wide} networkId={ev.networkId} jump={jump} />
      <p className="text-[10px] text-neutral-400">
        From Corteca&apos;s activity log, in your local time.{ev.truncated ? " Very busy network: only the newest 5,000 events were read." : ""}
      </p>
    </div>
  );
}
