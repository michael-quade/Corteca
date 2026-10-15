"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

export function subscriberName(s: Subscriber): string {
  return s.name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || s.customer_id || s.uuid || "Subscriber";
}

/** Compact subscriber search: one input, results float in a dropdown over the page. */
export function SubscriberSearchBox({ onSelect }: { onSelect: (s: Subscriber) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Subscriber[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const open = results !== null || !!error;

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) { setResults(null); setError(null); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function pick(s: Subscriber) {
    setResults(null);
    setQuery("");
    onSelect(s);
  }

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/subscribers?name=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      const list: Subscriber[] = Array.isArray(data) ? data : (data.content ?? []);
      if (list.length === 1) pick(list[0]);
      else setResults(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={search} className="flex items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") { setResults(null); setError(null); } }}
          placeholder="Search subscriber by name…"
          aria-label="Search subscriber"
          disabled={loading}
          className="w-64 rounded-l-md border border-neutral-300 px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
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
        <div className="absolute left-0 top-full z-40 mt-1 max-h-96 w-96 overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-xl">
          {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}
          {results?.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">No subscribers found.</p>}
          {results?.map((s) => {
            const net = s.home_wifis?.[0];
            return (
              <button
                key={s.customer_id ?? s.uuid}
                type="button"
                onClick={() => pick(s)}
                disabled={!net?.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-900">{subscriberName(s)}</span>
                  <span className="block truncate font-mono text-[11px] text-neutral-400">{net?.id ?? "No network"}{s.email ? ` · ${s.email}` : ""}</span>
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
