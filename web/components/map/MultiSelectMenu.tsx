"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";
import type { FilterOption } from "@/web/lib/regionFilter";

interface Props {
  label: string;
  /** Placeholder when nothing is ticked, e.g. "All continents". */
  allLabel: string;
  options: FilterOption[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}

const SEARCH_FROM = 8; // options before a search box is worth it

/** Popover with a checkbox per option (network count on the right), optional search and grouping. */
export function MultiSelectMenu({ label, allLabel, options, value, onChange, disabled }: Props) {
  const [q, setQ] = useState("");
  const shown = useMemo(
    () => (q.trim() ? options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())) : options),
    [options, q],
  );
  const picked = new Set(value);
  const summary = value.length === 0 ? allLabel
    : value.length === 1 ? options.find((o) => o.value === value[0])?.label ?? value[0]
    : `${value.length} selected`;
  const toggle = (v: string) => onChange(picked.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="min-w-[180px]">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      <Popover.Root onOpenChange={(o) => { if (!o) setQ(""); }}>
        <Popover.Trigger asChild disabled={disabled}>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm",
              "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50",
              value.length ? "border-blue-600 text-blue-700" : "border-neutral-300 text-neutral-700",
            )}
          >
            <span className="truncate">{summary}</span>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="shrink-0 text-neutral-400" aria-hidden>
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
            </svg>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom" align="start" sideOffset={4}
            className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[240px] rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
          >
            {options.length >= SEARCH_FROM && (
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`}
                className="mb-2 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
            )}
            <div className="max-h-72 overflow-y-auto">
              {shown.length === 0 && <p className="px-2 py-1.5 text-sm text-neutral-500">No matches</p>}
              {shown.map((o, i) => (
                <div key={o.value}>
                  {o.group && o.group !== shown[i - 1]?.group && (
                    <p className="px-2 pb-0.5 pt-2 text-xs font-semibold text-neutral-700 first:pt-0">{o.group}</p>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50">
                    <input type="checkbox" checked={picked.has(o.value)} onChange={() => toggle(o.value)} className="accent-blue-600" />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className="text-xs tabular-nums text-neutral-500">{o.count.toLocaleString()}</span>
                  </label>
                </div>
              ))}
            </div>
            {value.length > 0 && (
              <div className="mt-2 border-t border-neutral-100 pt-2 text-right">
                <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                  Clear
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
