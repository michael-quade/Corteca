"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { cn } from "@/web/lib/utils";
import { SwNetworkTable } from "@/web/components/tables/SwNetworkTable";
import type { NetworkSwEntry, SwSelection } from "@/web/components/SwOverview.types";

const NAME_BATCH = 50;

interface SwDrilldownProps {
  selection: SwSelection | null;
  networks: NetworkSwEntry[];
  filter: "all" | "online" | "offline";
  onClose: () => void;
}

function selectionLabel(sel: SwSelection): string {
  if (sel.type === "cell") return `${sel.releaseName} · ${sel.beaconModel}`;
  if (sel.type === "release") return sel.releaseName;
  return sel.beaconModel;
}

function filterNetworks(networks: NetworkSwEntry[], sel: SwSelection): NetworkSwEntry[] {
  if (sel.type === "cell") {
    return networks.filter((n) => n.releaseName === sel.releaseName && n.beaconModel === sel.beaconModel);
  }
  if (sel.type === "release") {
    return networks.filter((n) => n.releaseName === sel.releaseName);
  }
  return networks.filter((n) => n.beaconModel === sel.beaconModel);
}

export function SwDrilldown({ selection, networks, filter, onClose }: SwDrilldownProps) {
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [loadingNames, setLoadingNames] = useState(false);

  const filtered = useMemo(() => {
    if (!selection) return [];
    let result = filterNetworks(networks, selection);
    if (filter === "online")  result = result.filter((n) => n.online);
    if (filter === "offline") result = result.filter((n) => !n.online);
    return result;
  }, [networks, selection, filter]);

  // Fetch account names whenever the filtered list changes
  useEffect(() => {
    if (filtered.length === 0) {
      setAccountNames(new Map());
      return;
    }

    const macs = filtered.map((n) => n.mac.toUpperCase().replace(/:/g, '-'));
    const unique = [...new Set(macs)];
    const names = new Map<string, string>();
    setLoadingNames(true);
    setAccountNames(new Map());

    void (async () => {
      for (let i = 0; i < unique.length; i += NAME_BATCH) {
        const batch = unique.slice(i, i + NAME_BATCH);
        try {
          const res = await fetchWithAuth(
            `/api/network-map/account-names?macs=${encodeURIComponent(batch.join(","))}`,
          );
          if (res.ok) {
            const results = (await res.json()) as { mac: string; accountName: string }[];
            for (const { mac, accountName } of results) {
              if (accountName) names.set(mac, accountName);
            }
            setAccountNames(new Map(names));
          }
        } catch { /* non-blocking */ }
      }
      setLoadingNames(false);
    })();
  }, [filtered]);

  const isOpen = !!selection;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/30 transition-opacity duration-300",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-40 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label={selection ? selectionLabel(selection) : "SW Drilldown"}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              {selection?.type === "cell"
                ? "Release + Model"
                : selection?.type === "release"
                ? "All models for release"
                : "All releases for model"}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold text-neutral-900">
              {selection ? selectionLabel(selection) : ""}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {filtered.length} network{filtered.length !== 1 ? "s" : ""}
              {filter !== "all" && (
                <span className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
                  filter === "online" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                )}>
                  {filter} only
                </span>
              )}
              {loadingNames && (
                <span className="ml-2 inline-flex items-center gap-1 text-neutral-400">
                  <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-500" />
                  loading account names…
                </span>
              )}
              {!loadingNames && accountNames.size > 0 && (
                <span className="ml-2 text-neutral-400">
                  ({accountNames.size} name{accountNames.size !== 1 ? "s" : ""} resolved)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close panel"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden px-6 py-4">
          {filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-400">
              No networks in this selection.
            </p>
          ) : (
            <SwNetworkTable entries={filtered} accountNames={accountNames} />
          )}
        </div>
      </div>
    </>
  );
}
