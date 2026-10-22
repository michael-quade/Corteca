"use client";

import { cn } from "@/web/lib/utils";
import { SEARCH_FIELDS, type SearchField } from "@/web/lib/subscriberSearch";

/** "Search for" chips, as in the Corteca console's customer search. */
export function SearchFieldChips({ value, onChange, size = "md" }: {
  value: SearchField;
  onChange: (f: SearchField) => void;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label="Search for" className="flex flex-wrap gap-1.5">
      {SEARCH_FIELDS.map((f) => {
        const active = f.id === value;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(f.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full transition-colors",
              size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
              active ? "bg-blue-50 text-blue-700 ring-1 ring-blue-600" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
            )}
          >
            {f.label}
            {active && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
