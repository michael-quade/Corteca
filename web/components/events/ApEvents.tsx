"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/web/lib/utils";
import type { McpAccessPoint } from "@/web/lib/mcpNetwork";
import { mediumLabel, normaliseMac } from "@/web/lib/networkEvents";
import { apBadge, apStats, inPeriod, isSilenced, timelineSegments, type EventPeriod } from "@/web/lib/eventStats";
import { DAY, dateOnly, duration, shortDay } from "@/web/lib/eventFormat";
import { DetailRow, DetailSection } from "@/web/components/topology/DetailParts";
import { useSectionCollapse } from "@/web/components/topology/useSectionCollapse";
import { useEvents } from "./EventsContext";
import { EventPeriodSwitch } from "./EventFilters";
import { EventRow } from "./EventRow";
import { BadgeAckBar } from "./BadgeAckBar";

const LIST = 4;
const SEGMENT = { outage: "bg-red-600", degraded: "bg-amber-500", info: "bg-blue-300" } as const;

/** AP panel "Events": online/offline bar, tallies, badge state and this AP's events. */
export function ApEvents({ ap }: { ap: McpAccessPoint }) {
  const ev = useEvents();
  const mac = normaliseMac(ap.mac);
  const [period, setPeriod] = useState<EventPeriod>(30);
  const [all, setAll] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const own = useMemo(() => (ev?.items ?? []).filter((it) => it.device === mac && it.kind !== "routine" && it.category !== "console"), [ev?.items, mac]);
  const now = ev?.now ?? 0;
  const mine = useMemo(() => own.filter((it) => inPeriod(it, now, period)), [own, now, period]);
  const stats = useMemo(() => apStats(mine, now), [mine, now]);

  // The diagram badge's "Events" button opens this section and scrolls here.
  const focus = ev?.focusAp === mac;
  const [, setCollapsed] = useSectionCollapse("Events");
  useEffect(() => {
    if (!focus) return;
    setCollapsed(false);
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    ev?.setFocusAp(null);
  }, [focus, ev, setCollapsed]);

  if (!ev) return null;
  const from = now - period * DAY;
  const segments = timelineSegments(mine, from, now);
  const ack = ev.acks.acks[mac];
  const badge = apBadge(own, ack, now);
  const [prevMedium, newMedium] = stats.bandChange?.split("→") ?? [];
  const shown = all ? mine : mine.slice(0, LIST);

  return (
    <DetailSection
      title="Events" plain sectionRef={ref}
      actions={<EventPeriodSwitch value={period} onChange={setPeriod} small />}
      summary={ev.load !== "ready" ? "Reboots, outages and backhaul changes from Corteca's activity log"
        : [`${stats.outages}× offline`, `${stats.reboots} reboot${stats.reboots === 1 ? "" : "s"}`, stats.degraded > 0 && `backhaul bad ${stats.degraded}×`, period === 1 ? "24 h" : `${period} days`].filter(Boolean).join(" · ")}
    >

      {(ev.load === "loading" || ev.load === "idle") && (
        <p className="flex items-center gap-2 text-xs text-neutral-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
          Reading Corteca&apos;s activity log…
        </p>
      )}
      {ev.load === "error" && (
        <p className="text-xs text-neutral-500">
          Couldn&apos;t read the activity log.{" "}
          <button type="button" onClick={ev.retry} className="font-medium text-blue-600 hover:text-blue-700">Try again</button>
        </p>
      )}

      {ev.load === "ready" && (
        <>
          <BadgeAckBar mac={mac} badge={badge} silenced={isSilenced(ack, now) ? ack?.silencedUntil ?? null : null} />

          <div className="relative mb-1 h-3.5 overflow-hidden rounded bg-emerald-100" role="img" aria-label={`Online / offline over the last ${period === 1 ? "24 hours" : `${period} days`}`}>
            {segments.map((s, i) => (
              <span
                key={i}
                className={cn("absolute inset-y-0 min-w-[2px]", SEGMENT[s.severity])}
                style={{ left: `${((s.start - from) / (now - from)) * 100}%`, width: `${((s.end - s.start) / (now - from)) * 100}%` }}
              />
            ))}
          </div>
          <div className="mb-3 flex justify-between text-[10px] text-neutral-400">
            <span>{dateOnly(from)}</span><span>online · <span className="text-red-600">offline</span> · <span className="text-amber-600">backhaul bad</span></span><span>now</span>
          </div>

          <dl className="mb-2 space-y-1.5 text-xs">
            <DetailRow label="Offline episodes">{`${stats.outages}${stats.outages ? ` · ${duration(stats.outageMs)} in total` : ""}`}</DetailRow>
            <DetailRow label="Reboots">{`${stats.reboots}${stats.lastReboot ? ` (last ${shortDay(stats.lastReboot.start)})` : ""}`}</DetailRow>
            {stats.degraded > 0 && <DetailRow label="Backhaul degraded">{`${stats.degraded} time${stats.degraded === 1 ? "" : "s"}`}</DetailRow>}
            {stats.bandChanges > 0 && (
              <DetailRow label="Backhaul band changes">{`${stats.bandChanges} · ${mediumLabel(prevMedium)} → ${mediumLabel(newMedium)}`}</DetailRow>
            )}
          </dl>

          {mine.length === 0 ? (
            <p className="text-xs text-neutral-500">No events for this access point in this period.</p>
          ) : (
            <ol className="-mx-2 space-y-0.5">
              {shown.map((it) => <EventRow key={it.key} item={it} own />)}
            </ol>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4">
            {mine.length > LIST && (
              <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                {all ? "Show fewer" : `Show all ${mine.length}`}
              </button>
            )}
            <button type="button" onClick={() => ev.showDevice(mac)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
              Open in Network events
            </button>
          </div>
        </>
      )}
    </DetailSection>
  );
}
