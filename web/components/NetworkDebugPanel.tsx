"use client";

import { useState } from "react";
import type { NetworkTopologyData } from "@/web/components/NetworkTopologyMap";

/** Collapsible raw REST responses for the topology (debugging aid). */
export function NetworkDebugPanel({ data }: { data: NetworkTopologyData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-amber-800"
      >
        <span>Raw API response (debug)</span>
        <span>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-amber-200 p-4 sm:grid-cols-3">
          {(["networks", "topology", "mesh", "members"] as const).map((key) => (
            <div key={key}>
              <p className="mb-1 font-mono text-xs font-bold text-amber-700 uppercase">{key}</p>
              <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">
                {JSON.stringify(data[key], null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

