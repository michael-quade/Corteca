"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import type { EventItem } from "@/web/lib/eventItems";
import { clock, spanLabel } from "@/web/lib/eventFormat";
import { useTopologyUi } from "@/web/components/topology/TopologyContext";
import { useEvents } from "./EventsContext";

export const SEVERITY_DOT: Record<EventItem["severity"], string> = {
  outage: "bg-red-600",
  degraded: "bg-amber-500",
  info: "bg-blue-300",
};

/** The device an event row is about; selects it on the diagram when it is in the network now. */
export function EventDeviceLink({ mac }: { mac: string | null }) {
  const ev = useEvents();
  const ui = useTopologyUi();
  if (!ev || !mac) return null;
  const sel = ev.names.selection(mac);
  const label = ev.names.label(mac);
  if (!sel) return <span className="truncate text-neutral-500">{label}</span>;
  return (
    <button
      type="button"
      onClick={() => { if (ev.drawer === "expanded") ev.setDrawer("open"); ui.select(sel); }}
      className="truncate text-left font-medium text-blue-600 hover:text-blue-700"
    >
      {label}
    </button>
  );
}

/**
 * One event row. `wide` = the expanded card layout (time | dot | text | device);
 * otherwise stacked for the drawer. `own` = a device's own panel: subject without the
 * device name, no device link.
 */
export function EventRow({ item, wide, own, marker }: { item: EventItem; wide?: boolean; own?: boolean; marker?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const expandable = item.fields.length > 0 || item.events.length > 1;
  const title = own ? item.subject : item.title;

  const text = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-neutral-900">
        {!wide && (marker ?? <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", SEVERITY_DOT[item.severity])} aria-hidden />)}
        {expandable ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-left hover:text-blue-700">
            {title}
            <span className="ml-1 text-[10px] font-normal text-neutral-400">{open ? "▴" : "▾"}</span>
          </button>
        ) : <span>{title}</span>}
        {item.category === "operator" && (
          <span className="rounded-full bg-neutral-100 px-1.5 text-[10px] font-medium text-neutral-600">Operator</span>
        )}
      </div>
      {item.detail && <p className="text-[11px] text-neutral-600">{item.detail}</p>}
      {open && <RowDetails item={item} />}
    </div>
  );

  if (wide) {
    return (
      <li className={cn("grid items-start gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50", marker ? "grid-cols-[7.5rem_1.75rem_minmax(0,1fr)_14rem]" : "grid-cols-[7.5rem_0.75rem_minmax(0,1fr)_14rem]", open && "bg-neutral-50")}>
        <span className="text-xs tabular-nums text-neutral-500">{spanLabel(item)}</span>
        {marker ?? <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", SEVERITY_DOT[item.severity])} aria-hidden />}
        {text}
        <span className="min-w-0 text-right text-xs">{!own && <EventDeviceLink mac={item.device} />}</span>
      </li>
    );
  }
  return (
    <li className={cn("rounded-lg px-2 py-1.5 hover:bg-neutral-50", open && "bg-neutral-50")}>
      <div className="flex justify-between gap-2 text-[10px] text-neutral-500">
        <span className="tabular-nums">{spanLabel(item)}</span>
        {!own && <span className="min-w-0 truncate"><EventDeviceLink mac={item.device} /></span>}
      </div>
      {text}
    </li>
  );
}

function RowDetails({ item }: { item: EventItem }) {
  return (
    <div className="mt-1.5 space-y-1.5 text-[11px]">
      {item.fields.length > 0 && (
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
          {item.fields.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-neutral-500">{k}</dt>
              <dd className="break-words font-medium text-neutral-800">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.events.length > 1 && (
        <ol className="space-y-0.5 text-neutral-600">
          {item.events.slice(0, 25).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="w-11 flex-shrink-0 tabular-nums text-neutral-400">{clock(e.at)}</span>
              <span className="break-all font-mono text-[10px]">
                {e.operation}{e.data.new_channel ? ` → ${e.data.new_channel}` : e.data.new_health ? ` → ${e.data.new_health}` : ""}
              </span>
            </li>
          ))}
          {item.events.length > 25 && <li className="text-neutral-400">… {item.events.length - 25} more</li>}
        </ol>
      )}
    </div>
  );
}
