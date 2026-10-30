"use client";

import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";

// Pieces of NetworkMembersTable: the status badge and the per-column filter popover.

export function StatusBadge({ connected, paused }: { connected: boolean; paused?: boolean }) {
  if (paused) {
    return (
      <span className="flex items-center gap-1.5 text-orange-600">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
        Paused
      </span>
    );
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1.5 text-green-700">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
        Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-red-600">
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
      Offline
    </span>
  );
}

interface FilterPopoverProps {
  value: string;
  onChange: (v: string) => void;
  active: boolean;
}

export function FilterPopover({ value, onChange, active }: FilterPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Filter"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-neutral-200",
            active ? "text-blue-600" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2Z" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[180px] rounded-md border border-neutral-200 bg-white p-2 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Filter</p>
          <input
            autoFocus
            type="text"
            placeholder="Type to filter…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full rounded border border-neutral-200 px-2 py-1.5 text-sm",
              "placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
            )}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-1.5 w-full rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              Clear filter
            </button>
          )}
          <Popover.Arrow className="fill-neutral-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
