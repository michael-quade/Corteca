"use client";

import { cn } from "@/web/lib/utils";
import type { ApBadge } from "@/web/lib/eventStats";
import { dateOnly } from "@/web/lib/eventFormat";
import { useEvents } from "./EventsContext";

/** AP panel line for the diagram badge: shown (Acknowledge) or silenced (Unsilence). Only for this browser. */
export function BadgeAckBar({ mac, badge, silenced }: { mac: string; badge: ApBadge | null; silenced: number | null }) {
  const ev = useEvents();
  if (!ev || (!badge && silenced == null)) return null;
  if (silenced != null) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-neutral-100 px-2.5 py-1.5 text-[11px] text-neutral-600">
        <span className="flex-1">Badge silenced {silenced === -1 ? "until you turn it back on" : `until ${dateOnly(silenced)}`} (only for you)</span>
        <button type="button" onClick={() => ev.acks.unsilence(mac)} className="font-medium text-blue-600 hover:text-blue-700">Unsilence</button>
      </div>
    );
  }
  return (
    <div className={cn("mb-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5", badge!.recent ? "bg-red-50" : "bg-amber-50")}>
      <span className={cn("whitespace-nowrap rounded-full px-2 text-[10px] font-medium", badge!.recent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>
        {badge!.label}
      </span>
      <span className={cn("flex-1 text-[11px]", badge!.recent ? "text-red-700" : "text-amber-800")}>shown on the diagram</span>
      <button
        type="button"
        onClick={() => ev.acks.acknowledge(mac)}
        className="rounded-md border border-blue-600 bg-white px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50"
      >
        Acknowledge
      </button>
    </div>
  );
}
