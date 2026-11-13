"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventItem } from "@/web/lib/eventItems";
import { dayHeading, startOfDay } from "@/web/lib/eventFormat";
import { EventRow } from "./EventRow";

const DAYS_STEP = 7;
const PER_DAY = 8;

export const dayAnchor = (networkId: string, day: number) => `events-${networkId}-${day}`;

/** Rows grouped by day, newest first; a few days at a time, a few rows per busy day. */
export function EventList({ items, wide, networkId, jump }: {
  items: EventItem[];
  wide?: boolean;
  networkId: string;
  /** A day (start ms) picked on the day bars; bump `n` to jump again to the same day. */
  jump: { day: number; n: number } | null;
}) {
  const days = useMemo(() => {
    const map = new Map<number, EventItem[]>();
    for (const it of items) {
      const d = startOfDay(it.start);
      const list = map.get(d);
      if (list) list.push(it); else map.set(d, [it]);
    }
    return [...map.entries()];
  }, [items]);
  const [daysShown, setDaysShown] = useState(DAYS_STEP);
  const [openDays, setOpenDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!jump) return;
    const i = days.findIndex(([d]) => d === jump.day);
    if (i < 0) return;
    if (i >= daysShown) setDaysShown(i + 1);
    requestAnimationFrame(() => document.getElementById(dayAnchor(networkId, jump.day))?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [jump, days, daysShown, networkId]);

  if (!items.length) return <p className="px-1 py-3 text-xs text-neutral-500">No events match in this period.</p>;

  return (
    <div className="space-y-2">
      {days.slice(0, daysShown).map(([day, list]) => {
        const all = openDays.has(day);
        const shown = all ? list : list.slice(0, PER_DAY);
        return (
          <section key={day} id={dayAnchor(networkId, day)} className="scroll-mt-2">
            <h4 className="rounded-md bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700">
              {dayHeading(day)}
              {list.length > 3 && <span className="font-normal text-neutral-500"> · {list.length} events</span>}
            </h4>
            <ol className="mt-0.5 space-y-0.5">
              {shown.map((it) => <EventRow key={it.key} item={it} wide={wide} />)}
            </ol>
            {list.length > PER_DAY && (
              <button
                type="button"
                onClick={() => setOpenDays((s) => { const n = new Set(s); if (all) n.delete(day); else n.add(day); return n; })}
                className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {all ? "Show fewer" : `Show ${list.length - PER_DAY} more on ${new Date(day).toLocaleDateString([], { day: "numeric", month: "long" })}`}
              </button>
            )}
          </section>
        );
      })}
      {days.length > daysShown && (
        <button type="button" onClick={() => setDaysShown((n) => n + DAYS_STEP)} className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
          Load older events
        </button>
      )}
    </div>
  );
}
