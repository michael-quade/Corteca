"use client";

import type { SetAside } from "@/web/lib/fleet/noisy";
import { fmtInt } from "@/web/lib/fleet/labels";

/** Yellow note naming the devices the noisy-device rule set aside, with their counts. */
export function NoisyNote<T>({ items, name, unit, factor }: {
  items: SetAside<T>[];
  name: (t: T) => string;
  unit: string;
  factor: number;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3 rounded-xl bg-yellow-50 px-3 py-2 text-xs text-yellow-900 ring-1 ring-yellow-200">
      <span className="font-semibold">Set aside (more than {factor}× the next device): </span>
      {items.map((s, i) => (
        <span key={i}>
          {i > 0 && "; "}
          {name(s.item)}, {fmtInt(s.value)} {unit} ({fmtInt(s.ratio)}× the next)
        </span>
      ))}
      . They're still listed in the table below. Raise the limit at the top, or set it to 0, to chart them.
    </div>
  );
}
