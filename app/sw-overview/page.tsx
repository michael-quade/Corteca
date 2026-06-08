"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { SwHeatmap } from "@/web/components/SwHeatmap";
import { SwDrilldown } from "@/web/components/SwDrilldown";
import { SwMatrixModal } from "@/web/components/modals/SwMatrixModal";
import type { NetworkSwEntry, SwSelection } from "@/web/components/SwOverview.types";
import type { SwOverviewResponse, UnknownFirmwareEntry } from "@/app/api/sw-overview/route";

type Filter = "all" | "online" | "offline";

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7a6 6 0 1 0 6-6 6 6 0 0 0-4.24 1.76L1 4.5" />
      <path d="M1 1v3.5H4.5" />
    </svg>
  );
}

function formatAge(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
}

function UnknownFirmwareList({ items }: { items: UnknownFirmwareEntry[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <span className="text-sm font-semibold text-amber-900">
            Unknown SW builds ({items.length})
          </span>
          <span className="ml-2 text-xs text-amber-600">
            Firmware strings not matched to any BBDR release
          </span>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-amber-700 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-amber-200 px-5 pb-4">
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div key={item.firmware} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-white px-4 py-2.5 text-xs shadow-sm ring-1 ring-amber-100">
                <span className="font-mono font-semibold text-neutral-800 flex-1 min-w-[180px]">
                  {item.firmware || "(empty)"}
                </span>
                <span className="text-neutral-500">
                  {item.total} device{item.total !== 1 ? "s" : ""}
                  <span className="ml-1 text-emerald-600">({item.online} online)</span>
                </span>
                {item.derivedRelease && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-amber-700">
                    hint: {item.derivedRelease}
                  </span>
                )}
                {item.models.length > 0 && (
                  <span className="text-neutral-400">{item.models.join(", ")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function SwOverviewPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<SwOverviewResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selection, setSelection] = useState<SwSelection | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  const fetchOverview = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/sw-overview");
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error(`Server error (HTTP ${res.status})`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to fetch SW overview.");
      setData(json as SwOverviewResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setFetching(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nmRes = await fetchWithAuth("/api/network-map?force=true");
      if (!nmRes.ok) {
        const body = await nmRes.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((body.error as string) ?? `Report generation failed (HTTP ${nmRes.status})`);
      }
      await fetchOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }, [fetchOverview]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) void fetchOverview();
  }, [isLoading, isAuthenticated, fetchOverview]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  const busy = fetching || refreshing;
  const networks: NetworkSwEntry[] = data?.networks ?? [];
  const unknownFirmwares: UnknownFirmwareEntry[] = data?.unknownFirmwares ?? [];

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4l-4 4 4 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Heading row */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-neutral-900">Beacon Active SW Overview</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Visual matrix of active software releases across the managed Beacon fleet.
            {data && (
              <span className="ml-2 text-neutral-400">
                Report data from {formatAge(data.reportAge)}.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMatrixOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            SW Matrix
          </button>
          <button
            onClick={handleRefresh}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            {busy ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />Refreshing…</>
            ) : (
              <><RefreshIcon />Refresh</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="mt-1 font-mono text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {busy && !data && (
        <div className="flex flex-col items-center justify-center gap-3 py-28">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700" />
          <p className="text-sm text-neutral-400">Loading SW overview…</p>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Filter toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">Filter:</span>
            {(["all", "online", "offline"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {f === "all" ? "All" : f === "online" ? "Online only" : "Offline only"}
              </button>
            ))}
            <span className="ml-2 text-xs text-neutral-400">
              {networks.filter((n) => n.releaseName).length} matched ·{" "}
              {networks.filter((n) => !n.releaseName).length} unknown
            </span>
          </div>

          {/* Heatmap */}
          <SwHeatmap
            beaconModels={data.beaconModels}
            buildMatrix={data.buildMatrix}
            networks={networks}
            filter={filter}
            onSelect={setSelection}
            activeSelection={selection}
          />

          {/* Unknown builds */}
          <UnknownFirmwareList items={unknownFirmwares} />
        </div>
      )}

      {/* Drilldown panel */}
      <SwDrilldown
        selection={selection}
        networks={networks}
        filter={filter}
        onClose={() => setSelection(null)}
      />

      <SwMatrixModal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        onSaved={() => void fetchOverview()}
      />
    </main>
  );
}
