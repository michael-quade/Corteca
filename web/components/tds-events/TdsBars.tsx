"use client";

import { cn } from "@/web/lib/utils";
import { PRIORITIES, PRIORITY_META, type Priority } from "@/web/lib/eventPriority";
import { dateOnly } from "@/web/lib/eventFormat";
import type { TdsBucket } from "@/web/lib/tdsStats";
import { EventAxis } from "@/web/components/events/EventAxis";

/** "P1" pill in the level's colour. */
export function PriorityPill({ p, className }: { p: Priority; className?: string }) {
  const m = PRIORITY_META[p];
  return (
    <span title={m.label} className={cn("inline-flex h-4 flex-shrink-0 items-center rounded-full px-1.5 text-[10px] font-semibold ring-1 ring-inset", m.pill, className)}>
      {m.short}
    </span>
  );
}

const hourLabel = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Rows per hour (≤ 36 h) or per day, stacked P1 at the bottom; a click jumps the list to that day. */
export function TdsBars({ buckets, hourly, wide, legend = wide, height, onPick }: {
  buckets: TdsBucket[];
  hourly: boolean;
  /** Taller bars, legend on by default (the expanded view). */
  wide?: boolean;
  /** Colour legend under the bars (the drawer's severity chips already show the colours). */
  legend?: boolean;
  height?: number;
  onPick: (at: number) => void;
}) {
  const h = height ?? (wide ? 64 : 44);
  const max = Math.max(1, ...buckets.map((b) => b.counts.reduce((a, n) => a + n, 0)));
  const px = (n: number) => (n ? Math.max(2, Math.round((n / max) * (h - 4))) : 0);
  const label = (b: TdsBucket) => (hourly ? `${dateOnly(b.start)} ${hourLabel(b.start)}–${hourLabel(b.end)}` : dateOnly(b.start));
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: h }}>
        {buckets.map((b) => {
          const total = b.counts.reduce((a, n) => a + n, 0);
          const text = `${label(b)}: ${total ? PRIORITIES.filter((p) => b.counts[p - 1]).map((p) => `${b.counts[p - 1]} ${PRIORITY_META[p].label}`).join(", ") : "no events"}`;
          return (
            <button
              key={b.start}
              type="button"
              disabled={!total}
              onClick={() => onPick(b.start)}
              aria-label={text}
              title={text}
              className="flex h-full min-w-0 flex-1 flex-col-reverse justify-start gap-px rounded-sm hover:bg-neutral-100 disabled:cursor-default disabled:hover:bg-transparent"
            >
              {PRIORITIES.map((p) => (
                b.counts[p - 1] > 0 && <span key={p} className={cn("w-full last:rounded-t-sm", PRIORITY_META[p].bar)} style={{ height: px(b.counts[p - 1]) }} />
              ))}
            </button>
          );
        })}
      </div>
      <EventAxis slots={buckets} hourly={hourly} />
      {/* The drawer's severity chips carry the same colours, so only the wide view repeats them here. */}
      {legend && <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-neutral-600">
        {PRIORITIES.map((p) => (
          <span key={p} className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-sm", PRIORITY_META[p].bar)} />{PRIORITY_META[p].label}</span>
        ))}
      </div>}
    </div>
  );
}
