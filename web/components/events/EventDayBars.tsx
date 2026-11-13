"use client";

import { cn } from "@/web/lib/utils";
import type { DayBucket } from "@/web/lib/eventStats";
import { dateOnly } from "@/web/lib/eventFormat";

const COLOURS = { outage: "bg-red-600", degraded: "bg-amber-500", info: "bg-blue-300" } as const;

/** Events per day, stacked by severity; a click jumps the list to that day. */
export function EventDayBars({ buckets, wide, onPick }: { buckets: DayBucket[]; wide?: boolean; onPick: (day: number) => void }) {
  const h = wide ? 56 : 40;
  const max = Math.max(1, ...buckets.map((b) => b.outage + b.degraded + b.info));
  const px = (n: number) => (n ? Math.max(2, Math.round((n / max) * (h - 4))) : 0);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: h }}>
        {buckets.map((b) => {
          const total = b.outage + b.degraded + b.info;
          const text = `${dateOnly(b.day)}: ${total ? [b.outage && `${b.outage} outage`, b.degraded && `${b.degraded} degraded`, b.info && `${b.info} info`].filter(Boolean).join(", ") : "no events"}`;
          return (
            <button
              key={b.day}
              type="button"
              disabled={!total}
              onClick={() => onPick(b.day)}
              aria-label={text}
              title={text}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px rounded-sm hover:bg-neutral-100 disabled:cursor-default disabled:hover:bg-transparent"
            >
              {(["outage", "degraded", "info"] as const).map((k) => (
                b[k] > 0 && <span key={k} className={cn("w-full first:rounded-t-sm", COLOURS[k])} style={{ height: px(b[k]) }} />
              ))}
            </button>
          );
        })}
      </div>
      {wide ? (
        <div className="mt-1 flex gap-[2px] text-[10px] text-neutral-400">
          {buckets.map((b, i) => (
            <span key={b.day} className="min-w-0 flex-1 text-center">
              {i === 0 || i === buckets.length - 1 || new Date(b.day).getDate() % 5 === 0 ? new Date(b.day).getDate() : ""}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-0.5 flex justify-between text-[10px] text-neutral-400">
          <span>{dateOnly(buckets[0].day)}</span><span>today</span>
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-neutral-600">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-600" />Outage / reboot</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500" />Degraded</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-300" />Info</span>
      </div>
    </div>
  );
}
