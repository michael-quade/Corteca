"use client";

import { useState } from "react";

const EXAMPLES = ["Why is the WiFi slow in the evening?", "A device keeps dropping off WiFi", "Why did the Beacons go offline?"];

/** Plain-language problem box for troubleshoot-network. */
export function TroubleshootForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (query: string) => void }) {
  const [query, setQuery] = useState("");
  const submit = (q: string) => { if (q.trim() && !disabled) onSubmit(q.trim()); };

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => { e.preventDefault(); submit(query); }}
    >
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={2000}
          placeholder="Describe the problem, e.g. “Living room TV keeps dropping off WiFi”"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
        <button
          type="submit"
          disabled={disabled || !query.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Troubleshoot
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={disabled}
            onClick={() => { setQuery(ex); submit(ex); }}
            className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 hover:border-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </form>
  );
}
