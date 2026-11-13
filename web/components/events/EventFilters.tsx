"use client";

import { cn } from "@/web/lib/utils";
import { EVENT_CATEGORIES, type EventCategory } from "@/web/lib/networkEvents";
import { EVENT_PERIODS, type EventPeriod } from "@/web/lib/eventStats";
import { Hint } from "@/web/components/ui/Hint";
import { useEvents } from "./EventsContext";

const CATEGORY_HINT: Record<EventCategory, string> = {
  status: "Reboots, switch-offs, APs going offline and Corteca connection drops",
  mesh: "Backhaul health and band changes between Beacons",
  radio: "Channel changes",
  clients: "New clients, renames and device type changes",
  operator: "Settings changed and sign-ins by operators",
  diagnostics: "Diagnostics runs, log uploads, time zone",
  console: "Corteca Console sessions opened on this network (hidden by default)",
};

/** 24 h / 7 days / 30 days. */
export function EventPeriodSwitch({ value, onChange, small }: { value: EventPeriod; onChange: (p: EventPeriod) => void; small?: boolean }) {
  return (
    <div role="group" aria-label="Period" className="flex gap-0.5 rounded-lg bg-neutral-100 p-0.5">
      {EVENT_PERIODS.map((p) => (
        <button
          key={p.days}
          type="button"
          aria-pressed={value === p.days}
          onClick={() => onChange(p.days)}
          className={cn(
            "rounded-md font-medium",
            small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
            value === p.days ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-neutral-600 hover:bg-white"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Category chips (with counts), device picker, routine-reconnects switch. */
export function EventFilters({ counts, devices, routineCount, wide }: {
  counts: Map<EventCategory, number>;
  /** Devices with events in the period, for the picker. */
  devices: string[];
  routineCount: number;
  wide?: boolean;
}) {
  const ev = useEvents();
  if (!ev) return null;
  const select = (
    <select
      aria-label="Device"
      value={ev.device ?? ""}
      onChange={(e) => ev.setDevice(e.target.value || null)}
      className="max-w-[14rem] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
    >
      <option value="">All devices</option>
      {devices.map((mac) => <option key={mac} value={mac}>{ev.names.label(mac)}</option>)}
    </select>
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", !wide && "gap-x-3")}>
      <div className="flex flex-wrap gap-1.5">
        {EVENT_CATEGORIES.map((c) => {
          const on = ev.categories.has(c.id);
          const n = counts.get(c.id) ?? 0;
          return (
            <Hint key={c.id} text={CATEGORY_HINT[c.id]}>
              {(id) => (
                <button
                  type="button"
                  aria-pressed={on}
                  aria-describedby={id}
                  onClick={() => ev.toggleCategory(c.id)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                    on ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "bg-white text-neutral-600 ring-1 ring-neutral-300 hover:bg-neutral-50",
                    !n && "opacity-50"
                  )}
                >
                  {wide ? c.label : c.short} {n}
                </button>
              )}
            </Hint>
          );
        })}
      </div>
      {select}
      <Hint text="Reconnects and boot reports with no drop logged, and backhaul health moving between good and fair">
        {(id) => (
          <label aria-describedby={id} className="flex items-center gap-1.5 text-[11px] text-neutral-600">
            <input type="checkbox" checked={ev.routine} onChange={(e) => ev.setRoutine(e.target.checked)} className="accent-blue-600" />
            Show routine events ({routineCount})
          </label>
        )}
      </Hint>
    </div>
  );
}
