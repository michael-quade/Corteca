"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import type { ReportDevice } from "@/app/api/network-map/route";
import type { DeviceMarker } from "@/app/api/network-map/locate/route";
import { DeploymentTable } from "@/web/components/tables/DeploymentTable";
import { NetworkMapControls, type MapPhase } from "@/web/components/NetworkMapControls";
import { NetworkMapSearch } from "@/web/components/NetworkMapSearch";
import {
  continentFromLatLng, loadMarkerCache, saveMarkerCache, clearMarkerCache,
  loadNameCache, saveNameCache, clearNameClientCache,
  type CachedMarker, type Continent,
} from "@/web/lib/geoUtils";

const GlobalNetworkMap = dynamic(
  () => import("@/web/components/GlobalNetworkMap").then((m) => ({ default: m.GlobalNetworkMap })),
  { ssr: false, loading: () => <div className="flex h-[600px] items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50"><span className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" /></div> }
);

const BATCH      = 20;
const CONCURRENCY = 8;
const NAME_BATCH = 50;

interface Stats { total: number; online: number; offline: number }

export default function NetworkMapPage() {
  const { isAuthenticated, isLoading } = useAuth();

  const [phase, setPhase]             = useState<MapPhase>("idle");
  const [error, setError]             = useState<string | null>(null);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [located, setLocated]         = useState(0);
  const [progress, setProgress]       = useState(0);
  const [devices, setDevices]         = useState<DeviceMarker[]>([]);
  const [rawRows, setRawRows]         = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders]   = useState<string[]>([]);
  const [showOnline, setShowOnline]   = useState(true);
  const [showOffline, setShowOffline] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [reportAge, setReportAge]     = useState<string | null>(null);
  const [markerCache, setMarkerCache] = useState<Map<string, CachedMarker>>(new Map());
  const [flyToTarget, setFlyToTarget]         = useState<{ lat: number; lng: number } | null>(null);
  const [continentFilter, setContinentFilter] = useState<Continent | null>(null);
  const [countryFilter, setCountryFilter]     = useState<string | null>(null);
  const [macFilter, setMacFilter]             = useState<string | null>(null);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);

  useEffect(() => { setMarkerCache(loadMarkerCache()); }, []);

  const locateDevices = useCallback(async (onlineDevices: ReportDevice[], existingCache: Map<string, CachedMarker>) => {
    const newCache = new Map(existingCache);
    const toLocate = onlineDevices.filter((d) => !existingCache.has(d.mac));

    const cached = onlineDevices.filter((d) => existingCache.has(d.mac)).map((d) => existingCache.get(d.mac)!);
    if (cached.length > 0) {
      setDevices((prev) => [...prev, ...cached.map((m) => ({ ...m, online: true } as DeviceMarker))]);
      setLocated(cached.length);
    }
    if (toLocate.length === 0) { setProgress(100); return newCache; }

    const metaMap = new Map(onlineDevices.map((d) => [d.mac, d]));
    const chunks: ReportDevice[][] = [];
    for (let i = 0; i < toLocate.length; i += BATCH) chunks.push(toLocate.slice(i, i + BATCH));

    let done = cached.length;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const group = chunks.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        group.map((batch) => {
          const macs = batch.map((d) => d.mac).join(",");
          return fetchWithAuth(`/api/network-map/locate?macs=${encodeURIComponent(macs)}`)
            .then((r) => {
              if (r.headers.get("X-Rate-Limited") === "true") setRateLimited(true);
              return r.json() as Promise<{ mac: string; lat: number; lng: number; country: string; accountName: string }[]>;
            })
            .catch(() => [] as { mac: string; lat: number; lng: number; country: string; accountName: string }[]);
        })
      );
      const newMarkers: CachedMarker[] = results.flat().filter(Boolean).map((loc) => {
        const d = metaMap.get(loc.mac);
        return {
          mac: loc.mac, lat: loc.lat, lng: loc.lng,
          online: d?.online ?? true, model: d?.model ?? "", firmware: d?.firmware ?? "",
          customerId: d?.customerId ?? "", accountName: loc.accountName ?? "",
          country: loc.country ?? "", continent: continentFromLatLng(loc.lat, loc.lng),
        };
      });
      for (const m of newMarkers) newCache.set(m.mac, m);
      done += group.reduce((s, b) => s + b.length, 0);
      setLocated((n) => n + newMarkers.length);
      setDevices((prev) => [...prev, ...newMarkers.map((m) => ({ ...m } as DeviceMarker))]);
      setProgress(Math.min(99, Math.round((done / onlineDevices.length) * 100)));
    }
    return newCache;
  }, []);

  const load = useCallback(async (forceReport = false, forceLocate = false) => {
    setPhase("report"); setError(null); setDevices([]); setLocated(0); setProgress(0);
    setRawRows([]); setCsvHeaders([]); setRateLimited(false); setReportAge(null);

    try {
      const r1 = await fetchWithAuth(`/api/network-map${forceReport ? "?force=true" : ""}`);
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error ?? `HTTP ${r1.status}`);

      if (d1.cachedAt) {
        const ageMin = Math.round((Date.now() - d1.cachedAt) / 60_000);
        setReportAge(ageMin < 2 ? "just now" : ageMin < 60 ? `${ageMin}m ago` : `${Math.round(ageMin / 60)}h ago`);
      }

      setStats(d1.stats);
      const allDevices: ReportDevice[] = d1.devices ?? [];
      const baseRows: Record<string, string>[] = d1.rawRows ?? [];
      const baseHeaders: string[] = d1.headers ?? [];
      setPhase("locating");

      // Inject names from cache immediately, then update progressively as API responds.
      // Cache and lookup are keyed by Customer ID (the subscriber's customer_id in Corteca).
      const seedNames = forceReport ? new Map<string, string>() : loadNameCache();
      if (forceReport) clearNameClientCache();

      const applyNames = (names: Map<string, string>) => {
        const hasAny = [...names.values()].some(Boolean);
        setRawRows(baseRows.map((r) => {
          const mac  = (r["Home WiFi ID"] || r["MAC"] || "").trim();
          const name = mac ? names.get(mac) : undefined;
          return name ? { ...r, "Account Name": name } : r;
        }));
        setCsvHeaders(hasAny && !baseHeaders.includes("Account Name")
          ? ["Account Name", ...baseHeaders]
          : baseHeaders);
      };

      applyNames(seedNames); // show cached names immediately

      // Collect unique MACs whose name is not yet resolved (falsy = missing or previously empty)
      const uniqueMacs = [...new Set(
        allDevices.map((d) => d.mac).filter((mac) => mac && !seedNames.get(mac))
      )];
      const allNames = new Map(seedNames);
      const nameFetch = (async () => {
        for (let i = 0; i < uniqueMacs.length; i += NAME_BATCH) {
          const batch = uniqueMacs.slice(i, i + NAME_BATCH);
          const macs  = batch.join(",");
          try {
            const r = await fetchWithAuth(`/api/network-map/account-names?macs=${encodeURIComponent(macs)}`);
            if (r.ok) {
              const results = await r.json() as { mac: string; accountName: string }[];
              for (const { mac, accountName } of results) if (accountName) allNames.set(mac, accountName);
              applyNames(allNames);
              // Propagate resolved names to map markers so popups show the account name
              setDevices((prev) => prev.map((d) => {
                const name = allNames.get(d.mac);
                return (name && !d.accountName) ? { ...d, accountName: name } : d;
              }));
            }
          } catch { /* non-blocking */ }
        }
        // Only persist confirmed names; omitting empties so stale misses are retried next load
        saveNameCache(new Map([...allNames].filter(([, v]) => Boolean(v))));
      })();

      // Run locate concurrently with name fetching
      const currentCache = forceLocate ? new Map<string, CachedMarker>() : loadMarkerCache();
      if (forceLocate) clearMarkerCache();
      const onlineDevices = allDevices.filter((d) => d.online);
      const finalCache = await locateDevices(onlineDevices, currentCache);
      saveMarkerCache(finalCache);
      setMarkerCache(finalCache);
      setProgress(100);
      setPhase("done");
      await nameFetch;

      // Back-fill account names into the marker cache so future loads don't need to re-fetch names
      const updatedCache = new Map(finalCache);
      let cacheChanged = false;
      for (const [mac, name] of allNames) {
        if (!name) continue;
        const m = updatedCache.get(mac);
        if (m && !m.accountName) { updatedCache.set(mac, { ...m, accountName: name }); cacheChanged = true; }
      }
      if (cacheChanged) { saveMarkerCache(updatedCache); setMarkerCache(updatedCache); }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [locateDevices]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) load();
  }, [isLoading, isAuthenticated, load]);

  const filteredDevices = useMemo(() => {
    let list = devices;
    if (continentFilter) list = list.filter((d) => markerCache.get(d.mac)?.continent === continentFilter);
    if (countryFilter)   list = list.filter((d) => markerCache.get(d.mac)?.country   === countryFilter);
    return list;
  }, [devices, markerCache, continentFilter, countryFilter]);

  const tableRows = useMemo(() => {
    let rows = rawRows;
    if (macFilter) {
      rows = rows.filter((r) => (r["Home WiFi ID"] || r["MAC"] || "").trim() === macFilter);
    }
    if (!showOnline || !showOffline) {
      rows = rows.filter((r) => {
        const on = r["Online status"]?.toLowerCase() === "true";
        return showOnline ? on : !on;
      });
    }
    if (continentFilter || countryFilter) {
      rows = rows.filter((r) => {
        const mac = (r["Home WiFi ID"] || r["MAC"] || "").trim();
        const m   = markerCache.get(mac);
        if (!m) return false;
        if (continentFilter && m.continent !== continentFilter) return false;
        if (countryFilter   && m.country   !== countryFilter)   return false;
        return true;
      });
    }
    return rows;
  }, [rawRows, macFilter, showOnline, showOffline, continentFilter, countryFilter, markerCache]);

  if (isLoading || !isAuthenticated) {
    return <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" /></main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-6">
      <Link href="/dashboard" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Back to Dashboard
      </Link>

      <NetworkMapControls
        phase={phase} stats={stats} located={located} progress={progress}
        reportAge={reportAge} rateLimited={rateLimited} error={error}
        showOnline={showOnline} showOffline={showOffline}
        onNewReport={() => load(true, false)}
        onRefreshLocations={() => load(false, true)}
        onToggleOnline={() => setShowOnline((v) => !v)}
        onToggleOffline={() => setShowOffline((v) => !v)}
        onRetry={() => load(false, false)}
      />

      {(phase === "locating" || phase === "done") && (
        <>
          <NetworkMapSearch
            rawRows={rawRows} markerCache={markerCache}
            continentFilter={continentFilter} countryFilter={countryFilter}
            onFlyTo={(lat, lng) => setFlyToTarget({ lat, lng })}
            onClearFly={() => setFlyToTarget(null)}
            onContinentChange={setContinentFilter}
            onCountryChange={setCountryFilter}
            onMacSelect={setMacFilter}
            onResetView={() => setResetViewTrigger((n) => n + 1)}
          />
          <GlobalNetworkMap
            devices={filteredDevices} progress={progress}
            showOnline={showOnline} showOffline={showOffline}
            flyToTarget={flyToTarget}
            resetViewTrigger={resetViewTrigger}
            onPopupClose={() => setMacFilter(null)}
          />
        </>
      )}

      {tableRows.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-neutral-700">
            Deployment Report
            {macFilter && (
              <span className="ml-2 font-normal text-blue-500">
                — filtered to {rawRows.find((r) => (r["Home WiFi ID"] || r["MAC"] || "").trim() === macFilter)?.["Account Name"] || macFilter}
              </span>
            )}
            {!macFilter && (!showOnline || !showOffline) && (
              <span className="ml-2 font-normal text-neutral-400">
                — showing {showOnline ? "online" : "offline"} only
              </span>
            )}
          </h2>
          <DeploymentTable rows={tableRows} headers={csvHeaders} />
        </div>
      )}
    </main>
  );
}
