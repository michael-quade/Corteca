"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { RebootChart, type RebootRow } from "@/web/components/RebootChart";
import { RebootTable } from "@/web/components/tables/RebootTable";
import { findDeviceIdInfo, injectAccountNames } from "@/web/lib/reportNameEnrichment";

const NAME_BATCH = 50;

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7a6 6 0 1 0 6-6 6 6 0 0 0-4.24 1.76L1 4.5" />
      <path d="M1 1v3.5H4.5" />
    </svg>
  );
}

export default function RebootReportPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows]           = useState<RebootRow[]>([]);
  const [columns, setColumns]     = useState<string[]>([]);
  const [fetching, setFetching]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [loadingNames, setLoadingNames] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  const fetchReport = useCallback(async () => {
    setFetching(true);
    setError(null);
    setAccountNames(new Map());
    try {
      const res  = await fetchWithAuth("/api/reboot-report");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch report.");
      const list: RebootRow[] = Array.isArray(data) ? data : [];
      setRows(list);
      setColumns(list.length > 0 ? Object.keys(list[0]) : []);
      setFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed.");
    } finally {
      setFetching(false);
    }
  }, []);

  // Auto-fetch as soon as auth is confirmed
  useEffect(() => {
    if (!isLoading && isAuthenticated) fetchReport();
  }, [isLoading, isAuthenticated, fetchReport]);

  // Fetch account names whenever rows arrive
  useEffect(() => {
    if (rows.length === 0 || !isAuthenticated) return;
    const baseRows = rows as Record<string, string>[];
    const idInfo = findDeviceIdInfo(baseRows);
    if (!idInfo) return;

    const uniqueIds = [...new Set(
      baseRows.map((r) => r[idInfo.col] ? idInfo.normalizeId(r[idInfo.col]) : '').filter(Boolean)
    )];
    if (uniqueIds.length === 0) return;

    const names = new Map<string, string>();
    setLoadingNames(true);

    void (async () => {
      for (let i = 0; i < uniqueIds.length; i += NAME_BATCH) {
        const batch = uniqueIds.slice(i, i + NAME_BATCH);
        try {
          const qs = idInfo.lookupField === 'device_id'
            ? `macs=${encodeURIComponent(batch.join(','))}`
            : `ids=${encodeURIComponent(batch.join(','))}&lookupField=${idInfo.lookupField}`;
          const r = await fetchWithAuth(`/api/network-map/account-names?${qs}`);
          if (r.ok) {
            const results = await r.json() as { mac: string; accountName: string }[];
            for (const { mac, accountName } of results) if (accountName) names.set(mac, accountName);
            setAccountNames(new Map(names));
          }
        } catch { /* non-blocking */ }
      }
      setLoadingNames(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isAuthenticated]);

  const enrichedRows = useMemo(() => {
    const baseRows = rows as Record<string, string>[];
    if (accountNames.size === 0) return baseRows;
    const idInfo = findDeviceIdInfo(baseRows);
    if (!idInfo) return baseRows;
    return injectAccountNames(baseRows, accountNames, idInfo);
  }, [rows, accountNames]);

  const enrichedColumns = useMemo(() => {
    return accountNames.size > 0 ? ['Account Name', ...columns] : columns;
  }, [columns, accountNames]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4l-4 4 4 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Reboot Report</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {fetching && !fetchedAt
              ? "Fetching the most recent tenant-wide reboot report…"
              : fetchedAt
              ? `Fetched at ${fetchedAt.toLocaleTimeString()} · ${rows.length} record${rows.length !== 1 ? "s" : ""}`
              : "Tenant-wide device reboot history from Corteca."}
          </p>
        </div>
        <button
          onClick={fetchReport}
          disabled={fetching}
          className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          {fetching ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />Refreshing…</>
          ) : (
            <><RefreshIcon />Refresh</>
          )}
        </button>
      </div>

      {/* Full-page loading state (first fetch only) */}
      {fetching && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-28">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700" />
          <p className="text-sm text-neutral-400">Fetching reboot report from Corteca…</p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Failed to fetch report</p>
          <p className="mt-1 font-mono text-xs text-red-500">{error}</p>
        </div>
      )}

      {!fetching && !error && fetchedAt && rows.length === 0 && (
        <p className="py-16 text-center text-sm text-neutral-400">
          The report returned no records.
        </p>
      )}

      {rows.length > 0 && (
        <div className="space-y-8">
          <RebootChart rows={rows} />
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-neutral-900">Report Data</h2>
              {loadingNames && (
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-neutral-500" />
                  Loading account names…
                </span>
              )}
              {!loadingNames && accountNames.size > 0 && (
                <span className="text-xs text-neutral-400">{accountNames.size} account name{accountNames.size !== 1 ? 's' : ''} resolved</span>
              )}
            </div>
            <RebootTable rows={enrichedRows as RebootRow[]} columns={enrichedColumns} />
          </div>
        </div>
      )}
    </main>
  );
}
