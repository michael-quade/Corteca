"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@/web/lib/utils";
import { hasSubscriber, SEARCH_FIELDS, subscriberKey, subscriberName, type SearchField } from "@/web/lib/subscriberSearch";
import { useSubscriberSearch } from "@/web/lib/useSubscriberSearch";
import type { Subscriber } from "@/web/lib/corteca/types";

export { subscriberName };

/** Compact subscriber search: one input, results float in a dropdown over the page. */
export function SubscriberSearchBox({ onSelect }: { onSelect: (s: Subscriber) => void }) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("auto");
  const { results, loading, error, search: runSearch, reset } = useSubscriberSearch();
  const boxRef = useRef<HTMLDivElement>(null);
  const open = results !== null || !!error;

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) reset();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, reset]);

  function pick(s: Subscriber) {
    reset();
    setQuery("");
    onSelect(s);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    const list = await runSearch(query, field);
    if (list?.length === 1 && list[0].home_wifis?.[0]?.id) pick(list[0]);
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={search} className="flex items-center">
        <select
          value={field}
          onChange={(e) => setField(e.target.value as SearchField)}
          aria-label="Search for"
          disabled={loading}
          className="rounded-l-md border border-r-0 border-neutral-300 bg-neutral-50 py-1.5 pl-2 pr-6 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
        >
          {SEARCH_FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") reset(); }}
          placeholder="Name, email, MAC, serial…"
          aria-label="Search subscriber"
          disabled={loading}
          className="w-56 border border-neutral-300 px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-r-md border border-l-0 border-neutral-900 bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {loading ? "…" : "Search"}
        </button>
      </form>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-96 w-[28rem] overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-xl">
          {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}
          {results?.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">No matching results.</p>}
          {results?.map((s) => {
            const net = s.home_wifis?.[0];
            return (
              <button
                key={subscriberKey(s)}
                type="button"
                onClick={() => pick(s)}
                disabled={!net?.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-medium text-neutral-900", !hasSubscriber(s) && "font-normal italic text-neutral-500")}>
                    {subscriberName(s)}{net?.pc && <span className="font-normal not-italic text-neutral-500"> · {net.pc}</span>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-neutral-400">
                    {[net?.id ?? "No network", net?.sn, s.uuid ?? s.customer_id, s.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {net && (
                  <span className={cn("flex flex-shrink-0 items-center gap-1 text-xs", net.status?.online ? "text-green-700" : "text-neutral-400")}>
                    <span className={cn("h-2 w-2 rounded-full", net.status?.online ? "bg-green-500" : "bg-neutral-300")} />
                    {net.status?.online ? "Online" : "Offline"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
