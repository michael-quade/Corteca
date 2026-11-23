"use client";

import * as Popover from "@radix-ui/react-popover";
import { PICKABLE_COLUMNS, DEFAULT_VISIBLE, type ColumnKey } from "./memberColumns";

/** "Columns" menu for the client table, like the Corteca console's column picker. */
export function ClientColumnPicker({ visible, onToggle, onReset }: {
  visible: ColumnKey[];
  onToggle: (key: ColumnKey) => void;
  onReset: () => void;
}) {
  const isDefault = visible.length === DEFAULT_VISIBLE.length && DEFAULT_VISIBLE.every((k) => visible.includes(k));
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-white px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" />
          </svg>
          Columns
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom" align="end" sideOffset={4}
          className="z-50 w-56 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <p className="px-1 pb-1.5 text-xs font-semibold text-neutral-700">Show columns</p>
          <ul>
            {PICKABLE_COLUMNS.map((c) => (
              <li key={c.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-neutral-700 hover:bg-neutral-50">
                  <input type="checkbox" className="accent-blue-600" checked={visible.includes(c.key)} onChange={() => onToggle(c.key)} />
                  {c.label}
                  {c.connectedOnly && <span className="ml-auto text-[10px] text-neutral-400" title="Live values: shown on the Connected tab only">connected only</span>}
                </label>
              </li>
            ))}
          </ul>
          {!isDefault && (
            <button type="button" onClick={onReset} className="mt-1 w-full rounded px-1 py-1 text-left text-xs font-medium text-blue-600 hover:bg-blue-50">
              Reset to default
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
