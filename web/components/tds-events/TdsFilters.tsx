"use client";

import { cn } from "@/web/lib/utils";
import { PRIORITIES, PRIORITY_META, type Priority } from "@/web/lib/eventPriority";
import { TDS_GROUPS, type TdsGroup } from "@/web/lib/tdsEvents";
import { DAY, startOfDay } from "@/web/lib/eventFormat";
import { TDS_PRESETS, oldestDay, rangeBounds } from "@/web/lib/tdsStats";
import { Hint } from "@/web/components/ui/Hint";
import { useTdsEvents } from "./TdsEventsContext";

const chip = (on: boolean, n: number) => cn(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
  on ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-50",
  !n && "opacity-50"
);

const toInput = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromInput = (v: string) => new Date(`${v}T00:00`).getTime();

/** 24 h / 7 days / 30 days / Custom (two dates inside the 30 days Corteca keeps). */
export function TdsRangeSwitch({ small }: { small?: boolean }) {
  const tds = useTdsEvents();
  if (!tds) return null;
  const { range, setRange } = tds;
  const now = tds.base.now;
  const btn = (on: boolean) => cn(
    "rounded-md font-medium", small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
    on ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-neutral-600 hover:bg-white"
  );
  const { from, to } = rangeBounds(range, now);
  const input = "rounded-lg border border-neutral-300 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5">
        {TDS_PRESETS.map((p) => (
          <button key={p.days} type="button" aria-pressed={range.kind === "preset" && range.days === p.days}
            onClick={() => setRange({ kind: "preset", days: p.days })} className={btn(range.kind === "preset" && range.days === p.days)}>
            {p.label}
          </button>
        ))}
        <button type="button" aria-pressed={range.kind === "custom"} className={btn(range.kind === "custom")}
          onClick={() => setRange({ kind: "custom", from: startOfDay(now - 6 * DAY), to: now })}>
          Custom
        </button>
      </div>
      {range.kind === "custom" && (
        <div className="flex items-center gap-1 text-[11px] text-neutral-600">
          <input id="tds-range-from" type="date" aria-label="From" className={input} value={toInput(from)} min={toInput(oldestDay(now))} max={toInput(now)}
            onChange={(e) => e.target.value && setRange({ kind: "custom", from: fromInput(e.target.value), to: range.to })} />
          <span>–</span>
          <input id="tds-range-to" type="date" aria-label="To" className={input} value={toInput(to)} min={toInput(oldestDay(now))} max={toInput(now)}
            onChange={(e) => e.target.value && setRange({ kind: "custom", from: range.from, to: fromInput(e.target.value) + DAY - 1 })} />
        </div>
      )}
    </div>
  );
}

/** Severity chips, category chips, device picker, routine switch. */
export function TdsFilters({ counts, devices, routineCount, wide }: {
  counts: { priorities: Map<Priority, number>; groups: Map<TdsGroup, number> };
  devices: string[];
  routineCount: number;
  wide?: boolean;
}) {
  const tds = useTdsEvents();
  if (!tds) return null;
  const names = tds.base.names;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-semibold text-neutral-500">Severity</span>
        {PRIORITIES.map((p) => {
          const n = counts.priorities.get(p) ?? 0;
          return (
            <Hint key={p} text={PRIORITY_META[p].hint}>
              {(id) => (
                <button type="button" aria-pressed={tds.priorities.has(p)} aria-describedby={id} onClick={() => tds.togglePriority(p)} className={chip(tds.priorities.has(p), n)}>
                  <span className={cn("h-2 w-2 rounded-full", PRIORITY_META[p].bar)} aria-hidden />
                  {wide ? PRIORITY_META[p].label : PRIORITY_META[p].short} {n}
                </button>
              )}
            </Hint>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-semibold text-neutral-500">Type</span>
        {TDS_GROUPS.map((g) => {
          const n = counts.groups.get(g.id) ?? 0;
          return (
            <Hint key={g.id} text={g.hint}>
              {(id) => (
                <button type="button" aria-pressed={tds.groups.has(g.id)} aria-describedby={id} onClick={() => tds.toggleGroup(g.id)} className={chip(tds.groups.has(g.id), n)}>
                  {wide ? g.label : g.short} {n}
                </button>
              )}
            </Hint>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <select
          aria-label="Device"
          value={tds.device ?? ""}
          onChange={(e) => tds.setDevice(e.target.value || null)}
          className="max-w-[14rem] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        >
          <option value="">All devices</option>
          {devices.map((mac) => <option key={mac} value={mac}>{names.label(mac)}</option>)}
        </select>
        <Hint text="Reconnects with no drop logged (P2) and backhaul moving between good and fair (P3)">
          {(id) => (
            <label aria-describedby={id} className="flex items-center gap-1.5 text-[11px] text-neutral-600">
              <input type="checkbox" checked={tds.routine} onChange={(e) => tds.setRoutine(e.target.checked)} className="accent-blue-600" />
              Show routine events ({routineCount})
            </label>
          )}
        </Hint>
      </div>
    </div>
  );
}
