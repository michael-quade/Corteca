"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { cn } from "@/web/lib/utils";
import { SwHeatmap } from "@/web/components/SwHeatmap";
import { SwDrilldown } from "@/web/components/SwDrilldown";
import { SwMatrixModal } from "@/web/components/modals/SwMatrixModal";
import { UnknownFirmwareList } from "@/web/components/UnknownFirmwareList";
import { WifiFilterPills } from "@/web/components/WifiFilterPills";
import { SwFleetHealth } from "@/web/components/SwFleetHealth";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { StatusPill } from "@/web/components/corteca/StatusPill";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";
import { Notice } from "@/web/components/corteca/Notice";
import type { WifiGeneration } from "@/web/lib/wifiGeneration";
import type { NetworkSwEntry, SwSelection } from "@/web/components/SwOverview.types";
import type { SwOverviewResponse } from "@/app/api/sw-overview/route";

type Filter = "all" | "online" | "offline";

function NewReportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
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

export default function SwOverviewPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [data, setData] = useState<SwOverviewResponse | null>(null);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selection, setSelection] = useState<SwSelection | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [wifiFilter, setWifiFilter] = useState<WifiGeneration[]>([]);
  // Bumped by the "Unknown firmware" health tile to expand and reveal that list.
  const [unknownOpenRequest, setUnknownOpenRequest] = useState(0);

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

  // WiFi filter: with no pills selected every model column is shown; otherwise only
  // models tagged with a selected generation, and only networks/releases for those models.
  const { visibleModels, visibleNetworks, visibleBuildMatrix } = useMemo(() => {
    const allNetworks = data?.networks ?? [];
    if (!data || wifiFilter.length === 0) {
      return { visibleModels: data?.beaconModels ?? [], visibleNetworks: allNetworks, visibleBuildMatrix: data?.buildMatrix ?? {} };
    }
    const models = data.beaconModels.filter((m) => {
      const gen = data.modelWifi?.[m];
      return gen !== undefined && wifiFilter.includes(gen);
    });
    const modelSet = new Set(models);
    const buildMatrix: Record<string, Record<string, string>> = {};
    for (const [release, builds] of Object.entries(data.buildMatrix)) {
      if (Object.keys(builds).some((m) => modelSet.has(m))) buildMatrix[release] = builds;
    }
    return {
      visibleModels: models,
      visibleNetworks: allNetworks.filter((n) => n.beaconModel !== null && modelSet.has(n.beaconModel)),
      visibleBuildMatrix: buildMatrix,
    };
  }, [data, wifiFilter]);

  const handleWifiFilterChange = (next: WifiGeneration[]) => {
    setWifiFilter(next);
    setSelection(null);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  const busy = fetching || refreshing;
  const networks: NetworkSwEntry[] = data?.networks ?? [];
  const unknownFirmwares = data?.unknownFirmwares ?? [];

  const matched = visibleNetworks.filter((n) => n.releaseName).length;

  function showUnknown() {
    setUnknownOpenRequest((n) => n + 1);
    requestAnimationFrame(() => document.getElementById("unknown-firmware")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    // Plain light ground like the Corteca console (covers the global background image).
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f5f7fa]">
      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        {/* Header: breadcrumb title, last updated, actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              <Link href="/dashboard" className="text-neutral-500 transition-colors hover:text-blue-600">Dashboards</Link>
              <span className="mx-2 text-neutral-400">/</span>
              Beacon Active SW Overview
            </h1>
            <p className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              {data ? <>Report data from {formatAge(data.reportAge)}</> : "Visual matrix of active software releases across the managed Beacon fleet."}
              {data && (
                <button
                  type="button"
                  onClick={() => void fetchOverview()}
                  disabled={busy}
                  title="Reload the cached report"
                  aria-label="Reload the cached report"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200/70 text-neutral-500 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={cn(fetching && "animate-spin")}>
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
                  </svg>
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OutlineButton
              onClick={() => setMatrixOpen(true)}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              }
            >
              SW Matrix
            </OutlineButton>
            <OutlineButton
              onClick={handleRefresh}
              disabled={busy}
              icon={refreshing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /> : <NewReportIcon />}
            >
              {refreshing ? "Fetching report…" : "New Report"}
            </OutlineButton>
          </div>
        </div>

        {error && <Notice tone="error" title="Couldn't load the SW overview" onClose={() => setError(null)}>{error}</Notice>}

        {busy && !data && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white py-28">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
            <p className="text-sm text-neutral-500">Loading SW overview…</p>
          </div>
        )}

        {data && (
          <>
            <SwFleetHealth
              networks={visibleNetworks}
              onShowOnline={() => { setFilter("online"); setSelection(null); }}
              onShowUnknown={showUnknown}
            />

            <CortecaCard
              title="Release matrix"
              info="Beacons per release and model. Click a count, a release or a model to list its networks."
              actions={
                <>
                  <StatusPill tone="online">All online</StatusPill>
                  <StatusPill tone="fair">Some offline</StatusPill>
                  <StatusPill tone="neutral">All offline</StatusPill>
                </>
              }
            >
              <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
                <SegmentedControl
                  label="Online status"
                  value={filter}
                  onChange={(f) => { setFilter(f); setSelection(null); }}
                  options={[
                    { value: "all", label: "All" },
                    { value: "online", label: "Online only" },
                    { value: "offline", label: "Offline only" },
                  ]}
                />
                <WifiFilterPills
                  beaconModels={data.beaconModels}
                  modelWifi={data.modelWifi ?? {}}
                  selected={wifiFilter}
                  onChange={handleWifiFilterChange}
                />
                <span className="ml-auto text-xs text-neutral-500">
                  {matched.toLocaleString()} matched · {(visibleNetworks.length - matched).toLocaleString()} unknown
                </span>
              </div>

              {visibleModels.length === 0 ? (
                <p className="rounded-xl bg-neutral-50 py-12 text-center text-sm text-neutral-500">
                  No Beacon models are tagged with the selected WiFi type. Set WiFi types in the SW Matrix.
                </p>
              ) : (
                <SwHeatmap
                  beaconModels={visibleModels}
                  buildMatrix={visibleBuildMatrix}
                  networks={visibleNetworks}
                  filter={filter}
                  onSelect={setSelection}
                  activeSelection={selection}
                />
              )}
            </CortecaCard>

            <UnknownFirmwareList items={unknownFirmwares} onAssigned={() => void fetchOverview()} openRequest={unknownOpenRequest} />
          </>
        )}

        <SwDrilldown
          selection={selection}
          networks={visibleNetworks}
          filter={filter}
          onClose={() => setSelection(null)}
        />

        <SwMatrixModal
          open={matrixOpen}
          onClose={() => setMatrixOpen(false)}
          onSaved={() => void fetchOverview()}
        />
      </main>
    </div>
  );
}
