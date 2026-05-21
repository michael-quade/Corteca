"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { CachedMarker } from "@/web/lib/geoUtils";

interface SearchResult {
  mac: string;
  label: string;
  subLabel: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  rawRows: Record<string, string>[];
  markerCache: Map<string, CachedMarker>;
  onFlyTo: (lat: number, lng: number) => void;
  onClearFly: () => void;
  onMacSelect: (mac: string | null) => void;
  onResetView: () => void;
}

export function NetworkMapSearch({
  rawRows, markerCache,
  onFlyTo, onClearFly, onMacSelect, onResetView,
}: Props) {
  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState<SearchResult | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const dropRef                   = useRef<HTMLDivElement>(null);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const macToIdx = new Map<string, number>();
    const results: SearchResult[] = [];

    for (const row of rawRows) {
      const mac         = (row["Home WiFi ID"] || row["MAC"] || "").trim();
      const custId      = (row["Customer ID"] ?? "").trim();
      const accountName = (row["Account Name"] ?? row["Customer Name"] ?? row["Subscriber Name"] ?? row["Network Name"] ?? row["Name"] ?? "").trim();
      if (!mac) continue;

      if (macToIdx.has(mac)) {
        // Back-fill Customer ID if the stored result is missing it
        const idx = macToIdx.get(mac)!;
        if (custId && !results[idx].subLabel && results[idx].label) {
          results[idx] = { ...results[idx], subLabel: custId };
        }
        continue;
      }

      const label = accountName || custId;
      if (!label.toLowerCase().includes(q) && !mac.toLowerCase().includes(q)) continue;
      if (results.length >= 20) break;
      macToIdx.set(mac, results.length);
      const marker = markerCache.get(mac);
      results.push({ mac, label: label || mac, subLabel: accountName ? custId : "", lat: marker?.lat ?? null, lng: marker?.lng ?? null });
    }
    return results;
  }, [query, rawRows, markerCache]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(r: SearchResult) {
    setSelected(r);
    setQuery(r.label);
    setOpen(false);
    onMacSelect(r.mac);
    if (r.lat !== null && r.lng !== null) onFlyTo(r.lat, r.lng);
  }

  function handleClear() {
    setQuery("");
    setSelected(null);
    setOpen(false);
    onClearFly();
    onMacSelect(null);
    onResetView();
  }

  return (
    <div className="relative z-20 flex items-end gap-3">
      <div className="relative flex-1 min-w-[220px]">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Search Network</label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setOpen(true); }}
            onFocus={() => { if (searchResults.length > 0) setOpen(true); }}
            placeholder="Search by name or Customer ID…"
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 pr-8 text-sm placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
          />
          {query && (
            <button type="button" onClick={handleClear} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {open && searchResults.length > 0 && (
          <div ref={dropRef} className="absolute z-50 mt-1 w-full rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            {searchResults.map((r) => (
              <button
                key={r.mac} type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-800">{r.label}</span>
                  {r.subLabel && <span className="block truncate text-xs text-neutral-400">{r.subLabel}</span>}
                </span>
                {r.lat !== null
                  ? <span className="shrink-0 text-xs text-blue-500">→ map</span>
                  : <span className="shrink-0 text-xs text-neutral-300">no location</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
