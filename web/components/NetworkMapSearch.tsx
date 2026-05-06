"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import type { CachedMarker, Continent } from "@/web/lib/geoUtils";

const CONTINENTS: Continent[] = [
  "Africa", "Antarctica", "Asia", "Europe", "North America", "Oceania", "South America",
];

interface SearchResult {
  mac: string;
  label: string;       // accountName or customerId
  subLabel: string;    // customerId when label is accountName
  lat: number | null;
  lng: number | null;
}

interface Props {
  rawRows: Record<string, string>[];
  markerCache: Map<string, CachedMarker>;
  continentFilter: Continent | null;
  countryFilter: string | null;
  onFlyTo: (lat: number, lng: number) => void;
  onClearFly: () => void;
  onContinentChange: (c: Continent | null) => void;
  onCountryChange: (c: string | null) => void;
  onMacSelect: (mac: string | null) => void;
  onResetView: () => void;
}

export function NetworkMapSearch({
  rawRows, markerCache,
  continentFilter, countryFilter,
  onFlyTo, onClearFly, onContinentChange, onCountryChange,
  onMacSelect, onResetView,
}: Props) {
  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState<SearchResult | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const dropRef                   = useRef<HTMLDivElement>(null);

  const availableCountries = useMemo(() => {
    const countries = new Set<string>();
    for (const m of markerCache.values()) {
      if (m.country) countries.add(m.country);
    }
    return [...countries].sort();
  }, [markerCache]);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const results: SearchResult[] = [];

    for (const row of rawRows) {
      const mac         = (row["Home WiFi ID"] || row["MAC"] || "").trim();
      const custId      = (row["Customer ID"] ?? "").trim();
      const accountName = (row["Account Name"] ?? row["Customer Name"] ?? row["Subscriber Name"] ?? row["Network Name"] ?? row["Name"] ?? "").trim();
      if (!mac || seen.has(mac)) continue;
      const label = accountName || custId;
      if (!label.toLowerCase().includes(q) && !mac.toLowerCase().includes(q)) continue;
      seen.add(mac);
      const marker = markerCache.get(mac);
      results.push({ mac, label: label || mac, subLabel: accountName ? custId : "", lat: marker?.lat ?? null, lng: marker?.lng ?? null });
      if (results.length >= 20) break;
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
  }

  const hasFilters = selected || continentFilter || countryFilter;

  return (
    <div className="relative z-[1000] flex flex-wrap items-end gap-3">
      {/* Network search */}
      <div className="relative flex-1 min-w-[220px]">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Search Network</label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setOpen(true); }}
            onFocus={() => { if (searchResults.length > 0) setOpen(true); }}
            placeholder="Search by name…"
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

      {/* Continent filter */}
      <div className="min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Continent</label>
        <select
          value={continentFilter ?? ""}
          onChange={(e) => onContinentChange((e.target.value as Continent) || null)}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
        >
          <option value="">All Continents</option>
          {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Country filter */}
      <div className="min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-neutral-500">Country</label>
        <select
          value={countryFilter ?? ""}
          onChange={(e) => onCountryChange(e.target.value || null)}
          disabled={availableCountries.length === 0}
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 disabled:text-neutral-400"
        >
          <option value="">All Countries</option>
          {availableCountries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Clear all filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={() => { handleClear(); onContinentChange(null); onCountryChange(null); onResetView(); }}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
