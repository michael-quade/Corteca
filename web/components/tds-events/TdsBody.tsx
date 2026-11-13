"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { summarise } from "@/web/lib/eventStats";
import { downloadText, startOfDay } from "@/web/lib/eventFormat";
import { eventPriority } from "@/web/lib/eventPriority";
import { rangeBounds, tdsBuckets, tdsCounts, tdsCsv, tdsScope, tdsVisible } from "@/web/lib/tdsStats";
import { Notice } from "@/web/components/corteca/Notice";
import { EventSummaryTiles } from "@/web/components/events/EventSummaryTiles";
import { EventList } from "@/web/components/events/EventList";
import { useTdsEvents, type TdsUi } from "./TdsEventsContext";
import { PriorityPill, TdsBars } from "./TdsBars";
import { TdsTimeline } from "./TdsTimeline";
import { TdsFilters } from "./TdsFilters";

/** Rows on screen for the range / device / routine / severity / category filters. */
export function useTdsView(tds: TdsUi | null) {
  return useMemo(() => {
    if (!tds) return null;
    const now = tds.base.now;
    const { from, to } = rangeBounds(tds.range, now);
    const f = { from, to, device: tds.device, routine: tds.routine, priorities: tds.priorities, groups: tds.groups };
    const scoped = tdsScope(tds.items, f);
    const visible = tdsVisible(scoped, f);
    const routineCount = tdsScope(tds.items, { ...f, routine: true }).filter((it) => it.kind === "routine").length;
    const seen = new Set(tdsScope(tds.items, { ...f, device: null, routine: true }).map((it) => it.device).filter((d): d is string => !!d));
    if (tds.device) seen.add(tds.device);
    const names = tds.base.names;
    const devices = [...seen].sort((a, b) => Number(names.selection(b)?.kind === "ap") - Number(names.selection(a)?.kind === "ap") || names.label(a).localeCompare(names.label(b)));
    return { from, to, visible, counts: tdsCounts(scoped, f), routineCount, devices, ...tdsBuckets(visible, from, to) };
  }, [tds]);
}

export function downloadTdsCsv(tds: TdsUi, items: TdsUi["items"]) {
  const day = new Date(tds.base.now).toISOString().slice(0, 10);
  downloadText(tdsCsv(items, tds.base.names.label, (it, i) => eventPriority(it.events[i])), `tds-network-events-${tds.base.networkId}-${day}.csv`);
}

/** Fixed top (range, tiles, chart, timeline when wide, filters) over the scrolling list. */
export function TdsBody({ wide, lead }: { wide?: boolean; lead?: ReactNode }) {
  const tds = useTdsEvents();
  const view = useTdsView(tds);
  const [jump, setJump] = useState<{ day: number; n: number } | null>(null);
  // Tiles count the rows that pass every filter, like the chart and the list.
  const summary = useMemo(() => (tds && view ? summarise(view.visible, tds.base.now) : null), [tds, view]);
  if (!tds || !view || !summary) return null;
  const ev = tds.base;
  const px = wide ? "px-5" : "px-3.5";
  const pick = (at: number) => setJump((j) => ({ day: startOfDay(at), n: (j?.n ?? 0) + 1 }));

  if (ev.load !== "ready") {
    return (
      <div className={cn("space-y-3 overflow-y-auto py-3", px)}>
        {lead}
        {ev.load === "error" ? (
          <Notice tone="error" title="Couldn't read the activity log">
            {ev.error}{" "}
            <button type="button" onClick={ev.retry} className="font-medium text-blue-600 underline-offset-2 hover:underline">Try again</button>
          </Notice>
        ) : (
          <p className="flex items-center gap-2 py-1 text-xs text-neutral-500">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
            Reading Corteca&apos;s activity log…
          </p>
        )}
      </div>
    );
  }

  const gap = wide ? "space-y-4" : "space-y-3";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("shrink-0 overflow-y-auto border-b border-neutral-100 pb-3", wide ? "max-h-[65%]" : "max-h-[72%]", gap, px, wide ? "pt-4" : "pt-3")}>
        {lead}
        {wide ? <EventSummaryTiles summary={summary} wide /> : (
          // One line in the drawer, so the chart and every filter fit above the list.
          <p className="text-[11px] text-neutral-600">
            {[
              [summary.reboots, "reboot", "reboots"], [summary.outages, "AP offline", "AP offline"],
              [summary.degraded, "backhaul bad", "backhaul bad"], [summary.newClients, "new client", "new clients"],
            ].map(([n, one, many], i) => (
              <span key={String(one)}>{i > 0 && " · "}<b className="font-semibold text-neutral-900">{n}</b> {n === 1 ? one : many}</span>
            ))}
          </p>
        )}
        {wide ? (
          // Chart + timeline beside the filters, so all of it stays on screen above the list.
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)] gap-6">
            <div className="min-w-0 space-y-3">
              <TdsBars buckets={view.buckets} hourly={view.hourly} wide onPick={pick} />
              <TdsTimeline items={view.visible} from={view.from} to={view.to} onPick={pick} />
            </div>
            <div className="min-w-0 border-l border-neutral-100 pl-6">
              <TdsFilters counts={view.counts} devices={view.devices} routineCount={view.routineCount} wide />
            </div>
          </div>
        ) : (
          <>
            <TdsBars buckets={view.buckets} hourly={view.hourly} onPick={pick} />
            <TdsFilters counts={view.counts} devices={view.devices} routineCount={view.routineCount} />
          </>
        )}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto pt-3", gap, px, wide ? "pb-4" : "pb-3")}>
        <EventList items={view.visible} wide={wide} networkId={`tds-${ev.networkId}`} jump={jump}
          marker={(it) => <PriorityPill p={it.priority} className={wide ? "mt-0.5" : undefined} />} />
        <p className="text-[10px] text-neutral-400">
          From Corteca&apos;s activity log, in your local time. A row&apos;s severity is the highest of its events.
          {ev.truncated ? " Very busy network: only the newest 5,000 events were read." : ""}
        </p>
      </div>
    </div>
  );
}
