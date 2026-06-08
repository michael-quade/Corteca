"use client";

import { useState } from "react";
import type { UnknownFirmwareEntry } from "@/app/api/sw-overview/route";
import { AssignFirmwareModal } from "@/web/components/modals/AssignFirmwareModal";

interface AssignTarget {
  firmware: string;
  derivedRelease: string | null;
}

interface Props {
  items: UnknownFirmwareEntry[];
  onAssigned: () => void;
}

export function UnknownFirmwareList({ items, onAssigned }: Props) {
  const [expanded, setExpanded]         = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);

  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setExpanded((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <span className="text-sm font-semibold text-amber-900">
            Unknown SW builds ({items.length})
          </span>
          <span className="ml-2 text-xs text-amber-600">
            Firmware strings not matched to any BBDR release
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-amber-700 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 px-5 pb-4">
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div
                key={item.firmware}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-white px-4 py-2.5 text-xs shadow-sm ring-1 ring-amber-100"
              >
                <span className="min-w-[180px] flex-1 font-mono font-semibold text-neutral-800">
                  {item.firmware || "(empty)"}
                </span>
                <span className="text-neutral-500">
                  {item.total} device{item.total !== 1 ? "s" : ""}
                  <span className="ml-1 text-emerald-600">({item.online} online)</span>
                </span>
                {item.derivedRelease && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-amber-700">
                    hint: {item.derivedRelease}
                  </span>
                )}
                {item.models.length > 0 && (
                  <span className="text-neutral-400">{item.models.join(", ")}</span>
                )}
                <button
                  type="button"
                  onClick={() => setAssignTarget({ firmware: item.firmware, derivedRelease: item.derivedRelease })}
                  className="ml-auto shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-50"
                >
                  Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AssignFirmwareModal
        open={assignTarget !== null}
        onClose={() => setAssignTarget(null)}
        firmware={assignTarget?.firmware ?? ""}
        initialRelease={assignTarget?.derivedRelease ?? undefined}
        onAssigned={() => {
          setAssignTarget(null);
          onAssigned();
        }}
      />
    </section>
  );
}
