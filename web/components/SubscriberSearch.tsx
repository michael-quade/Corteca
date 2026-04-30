"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/web/components/ui/Button";
import { cn } from "@/web/lib/utils";
import type { Subscriber } from "@/web/lib/corteca/types";

interface SubscriberSearchProps {
  onSelect: (subscriber: Subscriber) => void;
  selectedId?: string;
}

export function SubscriberSearch({ onSelect, selectedId }: SubscriberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(false);

    try {
      const res = await fetch(`/api/subscribers?name=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      const list: Subscriber[] = Array.isArray(data) ? data : (data.content ?? []);
      setResults(list);
      setSearched(true);
      if (list.length === 1) onSelect(list[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = cn(
    "flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm",
    "placeholder:text-neutral-400",
    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1",
    "disabled:opacity-50"
  );

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder="Search by subscriber name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {searched && results.length === 0 && (
        <p className="text-sm text-neutral-500">No subscribers found for "{query}".</p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((sub) => {
            const networkId = sub.home_wifis?.[0]?.id;
            const online = sub.home_wifis?.[0]?.status?.online;
            const id = sub.customer_id ?? sub.uuid;
            const displayName =
              sub.name ??
              `${sub.first_name ?? ""} ${sub.last_name ?? ""}`.trim() ||
              sub.email ??
              id;
            const isSelected = selectedId === sub.customer_id || selectedId === sub.uuid;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelect(sub)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    isSelected
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 bg-white hover:border-neutral-400 hover:bg-neutral-50"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-neutral-900">{displayName}</span>
                    {networkId && (
                      <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            online ? "bg-green-500" : "bg-neutral-300"
                          )}
                        />
                        {online ? "Online" : "Offline"}
                      </span>
                    )}
                  </div>
                  {sub.email && (
                    <p className="mt-0.5 text-neutral-500">{sub.email}</p>
                  )}
                  {networkId && (
                    <p className="mt-0.5 font-mono text-xs text-neutral-400">
                      Network: {networkId}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
