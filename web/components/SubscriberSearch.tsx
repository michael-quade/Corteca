"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/web/components/ui/Button";
import { Notice } from "@/web/components/corteca/Notice";
import { SearchFieldChips } from "@/web/components/search/SearchFieldChips";
import { SubscriberResultsTable } from "@/web/components/tables/SubscriberResultsTable";
import { cn } from "@/web/lib/utils";
import { fieldLabel, type SearchField } from "@/web/lib/subscriberSearch";
import { useSubscriberSearch } from "@/web/lib/useSubscriberSearch";
import type { Subscriber } from "@/web/lib/corteca/types";

interface SubscriberSearchProps {
  onSelect: (subscriber: Subscriber) => void;
  /** `subscriberKey()` of the selected result */
  selectedKey?: string;
}

const PLACEHOLDER: Record<SearchField, string> = {
  auto: "Name, email, customer ID, MAC or serial number…",
  name: "Subscriber name…",
  email: "Email address…",
  customerId: "Customer ID…",
  mac: "MAC address, at least 4 octets (A4-FC-A1-2D)…",
  serial: "Serial number (ALCL…)…",
};

/** Customer search as in the Corteca console: field chips, search box, results table. */
export function SubscriberSearch({ onSelect, selectedKey }: SubscriberSearchProps) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("auto");
  const { results, fields, truncated, loading, error, search } = useSubscriberSearch();

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const list = await search(query, field);
    if (list?.length === 1 && list[0].home_wifis?.[0]?.id) onSelect(list[0]);
  }

  const inputClass = cn(
    "flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm",
    "placeholder:text-neutral-400",
    "focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20",
    "disabled:opacity-50"
  );

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          placeholder={PLACEHOLDER[field]}
          aria-label="Search subscribers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
          className={inputClass}
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-700">Search for</span>
        <SearchFieldChips value={field} onChange={setField} />
      </div>

      {error && <Notice tone="error" title="Search failed">{error}</Notice>}

      {results && (
        <p className="text-xs text-neutral-500">
          {results.length === 0
            ? "No matching results"
            : truncated
              ? `First ${results.length} matching results — refine the search to see others`
              : `${results.length} matching result${results.length === 1 ? "" : "s"}`}
          {fields.length > 0 && ` · searched ${fields.map(fieldLabel).join(", ")}`}
        </p>
      )}

      {results && results.length > 0 && (
        <SubscriberResultsTable results={results} selectedKey={selectedKey} onSelect={onSelect} />
      )}
    </div>
  );
}
