"use client";

import { useEffect, useState } from "react";
import { parseNoisyFactor } from "@/web/lib/fleet/noisy";

/**
 * The page-wide noisy-device limit: "Set aside a device with more than [10]× the next one".
 * Applied on Enter / leaving the field; 0 turns it off. Changing it only redraws — the views
 * keep per-device counts, so nothing is read again.
 */
export function NoisyControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = parseNoisyFactor(draft);
    if (n == null) setDraft(String(value));
    else if (n !== value) onChange(n);
  };

  return (
    <label
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
      title="A device whose count is more than this many times the next device's is set aside (and named) so the other bars stay readable. 0 = never set aside."
    >
      Noisy device &gt;
      <input
        id="fleet-noisy"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setDraft(String(value)); }}
        className="w-14 rounded-md border border-neutral-300 px-1.5 py-0.5 text-right tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        aria-label="Noisy device factor"
      />
      × next
    </label>
  );
}
