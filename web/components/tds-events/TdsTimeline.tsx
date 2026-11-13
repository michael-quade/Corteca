"use client";

import { useState } from "react";
import { cn } from "@/web/lib/utils";
import { PRIORITIES, PRIORITY_META, type Priority } from "@/web/lib/eventPriority";
import { dateOnly, spanLabel } from "@/web/lib/eventFormat";
import type { TdsItem } from "@/web/lib/tdsEvents";

const MIN_SPAN = 0.004; // a span shorter than this share of the range draws as a dot

/**
 * Each row at its exact time, one lane per level: dots for moments, bars for spans
 * (outages, backhaul episodes). Hover shows the row; a click jumps the list to its day.
 */
export function TdsTimeline({ items, from, to, onPick, caption = true }: {
  items: TdsItem[];
  /** "Dot = one event …" line under the lanes. */
  caption?: boolean;
  from: number;
  to: number;
  onPick: (at: number) => void;
}) {
  const [hover, setHover] = useState<{ item: TdsItem; x: number } | null>(null);
  const span = Math.max(1, to - from);
  const pos = (t: number) => Math.min(1, Math.max(0, (t - from) / span));
  const lanes = new Map<Priority, TdsItem[]>(PRIORITIES.map((p) => [p, []]));
  for (const it of items) lanes.get(it.priority)!.push(it);

  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1" onMouseLeave={() => setHover(null)}>
      {PRIORITIES.map((p) => (
        <div key={p} className="contents">
          <span className="text-[11px] text-neutral-600">{PRIORITY_META[p].label}</span>
          <div className="relative h-[18px] rounded bg-neutral-100">
            {lanes.get(p)!.map((it) => {
              const x0 = pos(it.start), x1 = pos(it.end ?? it.start);
              const isSpan = x1 - x0 >= MIN_SPAN;
              const text = `${PRIORITY_META[p].short} · ${dateOnly(it.start)} ${spanLabel(it)} · ${it.title}`;
              return (
                <button
                  key={it.key}
                  type="button"
                  aria-label={text}
                  onMouseEnter={() => setHover({ item: it, x: x0 })}
                  onFocus={() => setHover({ item: it, x: x0 })}
                  onBlur={() => setHover(null)}
                  onClick={() => onPick(it.start)}
                  style={isSpan ? { left: `${x0 * 100}%`, width: `${(x1 - x0) * 100}%` } : { left: `${x0 * 100}%` }}
                  className={cn(
                    "absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                    PRIORITY_META[p].bar,
                    // Dots above spans, so a long outage never hides a short event at the same time.
                    isSpan ? "top-[6px] z-0 h-1.5 rounded-sm opacity-90" : "top-1 z-[1] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-white",
                    hover?.item.key === it.key && "z-10 scale-125"
                  )}
                />
              );
            })}
            {hover?.item.priority === p && (
              <div
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-20 mb-1.5 max-w-[22rem] rounded-lg bg-neutral-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg"
                style={hover.x > 0.6 ? { right: `${(1 - hover.x) * 100}%` } : { left: `${hover.x * 100}%` }}
              >
                <p className="font-semibold">{PRIORITY_META[p].short} · {dateOnly(hover.item.start)} {spanLabel(hover.item)}</p>
                <p className="truncate">{hover.item.title}</p>
                {hover.item.detail && <p className="truncate text-neutral-300">{hover.item.detail}</p>}
              </div>
            )}
          </div>
        </div>
      ))}
      {caption && <>
        <span />
        <p className="text-[10px] text-neutral-400">Dot = one event · bar = how long it lasted · click to jump the list to that day</p>
      </>}
    </div>
  );
}
