"use client";

import { cn } from "@/web/lib/utils";
import type { EventSummary } from "@/web/lib/eventStats";
import { dateOnly, duration } from "@/web/lib/eventFormat";
import { useEvents } from "./EventsContext";

/** Reboots / AP offline / Backhaul degraded / New clients: counts only (sub-lines in the wide layout). */
export function EventSummaryTiles({ summary, wide }: { summary: EventSummary; wide?: boolean }) {
  const ev = useEvents();
  if (!ev) return null;
  const short = ev.names.short;
  const rebootsBy = [...summary.rebootsBy.entries()].map(([mac, n]) => `${short(mac)} ×${n}`).join(" · ");
  const degraded = [...summary.degradedDevices];
  const tiles = [
    { label: "Reboots", value: summary.reboots, sub: rebootsBy || "none" },
    { label: "AP offline", value: summary.outages, sub: summary.outages ? `${duration(summary.outageMs)} offline in total` : "no outages" },
    {
      label: wide ? "Backhaul degraded" : "Backhaul bad", value: summary.degraded,
      sub: degraded.length === 1 ? `all ${short(degraded[0])}` : degraded.length ? `${degraded.length} Beacons` : "none",
    },
    {
      label: "New clients", value: summary.newClients,
      sub: summary.lastNewClient ? `last: ${short(summary.lastNewClient.device, summary.lastNewClient.events[0].data.name)}, ${dateOnly(summary.lastNewClient.start)}` : "none",
    },
  ];
  return (
    <div className="grid grid-cols-4">
      {tiles.map((t, i) => (
        <div key={t.label} className={cn("min-w-0", i > 0 && "border-l border-neutral-200", wide ? "px-4 first:pl-0" : "px-2 first:pl-0")}>
          <p className={cn("truncate text-neutral-700", wide ? "text-sm" : "text-[10px]")}>{t.label}</p>
          <p className={cn("font-semibold text-neutral-900", wide ? "text-2xl" : "text-lg leading-tight")}>{t.value}</p>
          {wide && <p className="truncate text-xs text-neutral-500" title={t.sub}>{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}
