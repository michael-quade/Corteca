"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";
import { mediumLabel, normaliseMac } from "@/web/lib/networkEvents";
import { BADGE_DAYS, apBadge, apStats, inPeriod, isSilenced } from "@/web/lib/eventStats";
import { DAY, dateOnly, duration, shortDay } from "@/web/lib/eventFormat";
import { useTopologyUi } from "@/web/components/topology/TopologyContext";
import { useEvents } from "./EventsContext";

// Clicks and keys inside the badge / its popover must not select the AP card or reach the canvas.
const stop = (e: SyntheticEvent) => e.stopPropagation();

const SILENCE = [
  { label: "For 24 hours", ms: DAY },
  { label: "For 7 days", ms: 7 * DAY },
  { label: "Until I turn it back on", ms: -1 },
];

/** Recent reboots / outages on an AP card, with acknowledge and silence (this browser only). */
export function EventBadge({ mac: rawMac }: { mac: string }) {
  const ev = useEvents();
  const ui = useTopologyUi();
  const mac = normaliseMac(rawMac);
  const [open, setOpen] = useState(false);
  const [silenceMenu, setSilenceMenu] = useState(false);
  const own = useMemo(() => (ev?.items ?? []).filter((it) => it.device === mac && it.kind !== "routine"), [ev?.items, mac]);
  if (!ev || ev.load !== "ready") return null;

  const ack = ev.acks.acks[mac];
  const silenced = isSilenced(ack, ev.now);
  const badge = apBadge(own, ack, ev.now);
  if (!badge && !silenced) return null;

  const recent = own.filter((it) => inPeriod(it, ev.now, BADGE_DAYS));
  const stats = apStats(recent, ev.now);
  const latest = badge?.outages.reduce((a, b) => (b.start > a.start ? b : a));
  const [prevMedium, newMedium] = stats.bandChange?.split("→") ?? [];
  const close = () => { setOpen(false); setSilenceMenu(false); };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSilenceMenu(false); }}>
      <Popover.Trigger asChild>
        {silenced ? (
          <button type="button" onClick={stop} aria-label="Event badge silenced" className="nodrag absolute -bottom-2.5 left-16 rounded-full bg-white p-0.5 text-neutral-400 shadow ring-1 ring-neutral-200 hover:text-neutral-600">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M6 8a6 6 0 0110.5-4M18 8c0 7 3 9 3 9H9M13.7 21a2 2 0 01-3.4 0M3 3l18 18" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className={cn(
              "nodrag absolute -bottom-2.5 left-16 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-px text-[10px] font-medium shadow-sm ring-1",
              badge!.recent ? "bg-red-50 text-red-700 ring-red-200" : "bg-amber-50 text-amber-800 ring-amber-300"
            )}
          >
            {badge!.isNew && <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden />}
            {badge!.label}
          </button>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom" align="start" sideOffset={6}
          onClick={stop} onPointerDown={stop} onKeyDown={stop}
          className="z-50 w-64 space-y-2 rounded-xl border border-neutral-200 bg-white p-3 text-xs shadow-lg"
        >
          <p className="font-semibold text-neutral-900">Last {BADGE_DAYS} days</p>
          <ul className="space-y-0.5 text-[11px] text-neutral-600">
            <li>{stats.outages} offline episode{stats.outages === 1 ? "" : "s"}{stats.outages ? ` · ${duration(stats.outageMs)}` : ""}</li>
            {stats.reboots > 0 && <li>{stats.reboots} reboot{stats.reboots === 1 ? "" : "s"}</li>}
            {stats.degraded > 0 && <li>Backhaul degraded {stats.degraded} time{stats.degraded === 1 ? "" : "s"}</li>}
            {stats.bandChanges > 0 && <li>Backhaul {mediumLabel(prevMedium)} → {mediumLabel(newMedium)} {stats.bandChanges} time{stats.bandChanges === 1 ? "" : "s"}</li>}
            {latest && <li>Latest: {latest.subject.toLowerCase()}, {shortDay(latest.start)}</li>}
          </ul>
          {silenced ? (
            <p className="rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600">
              Silenced {ack?.silencedUntil === -1 ? "until you turn it back on" : `until ${dateOnly(ack!.silencedUntil!)}`} (only for you).
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {silenced ? (
              <button type="button" onClick={() => { ev.acks.unsilence(mac); close(); }} className="rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700">Unsilence</button>
            ) : (
              <>
                <button type="button" onClick={() => { ev.acks.acknowledge(mac); close(); }} className="rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700">Acknowledge</button>
                <button type="button" aria-expanded={silenceMenu} onClick={() => setSilenceMenu((v) => !v)} className="rounded-md border border-blue-600 px-2.5 py-1 font-medium text-blue-600 hover:bg-blue-50">Silence ▾</button>
              </>
            )}
            <button
              type="button"
              onClick={() => { ui.select({ kind: "ap", id: rawMac }); ev.setFocusAp(mac); close(); }}
              className="px-1 py-1 font-medium text-blue-600 hover:text-blue-700"
            >
              Events
            </button>
          </div>
          {silenceMenu && (
            <div className="flex flex-col rounded-lg border border-neutral-200 p-1">
              {SILENCE.map((s) => (
                <button key={s.label} type="button" onClick={() => { ev.acks.silence(mac, s.ms === -1 ? -1 : Date.now() + s.ms); close(); }} className="rounded-md px-2 py-1 text-left text-[11px] text-neutral-800 hover:bg-blue-50 hover:text-blue-700">
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] leading-snug text-neutral-500">
            <strong className="font-semibold text-neutral-600">Acknowledge</strong> hides the badge until the next reboot or outage.{" "}
            <strong className="font-semibold text-neutral-600">Silence</strong> hides it even if new ones happen. Only for you, in this browser.
          </p>
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
