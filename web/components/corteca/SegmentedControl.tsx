"use client";

import { cn } from "@/web/lib/utils";

/** Corteca-style segmented control (blue-tinted active segment). */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "text-neutral-600 hover:bg-neutral-50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
