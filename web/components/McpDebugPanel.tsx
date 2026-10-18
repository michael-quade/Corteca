"use client";

import { useState } from "react";

export interface McpResponse {
  homeWifiId: string;
  query: string;
  durationMs: number;
  summary: string | null;
  payload: unknown;
}

/** Collapsible raw retrieve-network-data response, for debugging. */
export function McpDebugPanel({ response }: { response: McpResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium text-amber-800"
      >
        <span>Raw MCP response (debug) · retrieve-network-data · {(response.durationMs / 1000).toFixed(1)}s</span>
        <span>{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-amber-200 p-4">
          <p className="font-mono text-xs text-amber-700">query: “{response.query}”</p>
          {response.summary && (
            <p className="whitespace-pre-wrap rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">{response.summary}</p>
          )}
          <pre className="max-h-96 overflow-auto rounded bg-white p-2 text-xs text-neutral-700 ring-1 ring-amber-200">
            {JSON.stringify(response.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
