"use client";

import { cn } from "@/web/lib/utils";
import { SEVERITY_ORDER, SEVERITY_PILL } from "./severity";

/** Result counts per severity; clicking a pill filters the table to it. */
export function AlarmSeverityChips({ counts, active, onToggle, onClear }: {
  counts: Record<string, number>;
  active: Set<string>;
  onToggle: (sev: string) => void;
  onClear: () => void;
}) {
  const ordered = Object.entries(counts).sort(([a], [b]) => {
    const ia = SEVERITY_ORDER.indexOf(a), ib = SEVERITY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return (
    <>
      {ordered.map(([sev, count]) => {
        const on = active.has(sev);
        return (
          <button
            key={sev}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(sev)}
            title={on ? `Remove ${sev} filter` : `Show only ${sev}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all",
              SEVERITY_PILL[sev] ?? "bg-neutral-100 text-neutral-600",
              on ? "ring-2 ring-blue-600 ring-offset-1" : active.size > 0 && "opacity-50 hover:opacity-100",
            )}
          >
            {count} {sev}
          </button>
        );
      })}
      {active.size > 0 && (
        <button type="button" onClick={onClear} className="text-xs font-medium text-blue-600 hover:underline">Clear filter</button>
      )}
    </>
  );
}
