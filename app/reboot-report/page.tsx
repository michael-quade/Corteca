"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { RebootChart, type RebootRow } from "@/web/components/RebootChart";
import { RebootTable } from "@/web/components/tables/RebootTable";
import { findDeviceIdInfo, injectAccountNames } from "@/web/lib/reportNameEnrichment";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { Notice } from "@/web/components/corteca/Notice";

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

  if (isLoading) return <CortecaLoading />;

  if (!isAuthenticated) return null;

  return (
    <CortecaPage
      title="Reboot Report"
      meta={
        fetching && !fetchedAt
          ? "Fetching the most recent tenant-wide reboot report…"
          : fetchedAt
          ? `Fetched at ${fetchedAt.toLocaleTimeString()} · ${rows.length} record${rows.length !== 1 ? "s" : ""}`
          : "Tenant-wide device reboot history from Corteca."
      }
      actions={
        <OutlineButton
          onClick={fetchReport}
          disabled={fetching}
          icon={fetching ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" /> : <RefreshIcon />}
        >
          {fetching ? "Refreshing…" : "Refresh"}
        </OutlineButton>
      }
    >
      {/* Full-page loading state (first fetch only) */}
      {fetching && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white py-28">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
          <p className="text-sm text-neutral-500">Fetching reboot report from Corteca…</p>
        </div>
      )}

      {error && <Notice tone="error" title="Failed to fetch report">{error}</Notice>}

      {!fetching && !error && fetchedAt && rows.length === 0 && (
        <CortecaCard><p className="py-12 text-center text-sm text-neutral-500">The report returned no records.</p></CortecaCard>
      )}

      {rows.length > 0 && (
        <>
          <RebootChart rows={rows} />
          <CortecaCard
            title="Report data"
            actions={
              <>
                {loadingNames && (
                  <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <span className="h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600" />
                    Loading account names…
                  </span>
                )}
                {!loadingNames && accountNames.size > 0 && (
                  <span className="text-xs text-neutral-500">{accountNames.size} account name{accountNames.size !== 1 ? "s" : ""} resolved</span>
                )}
              </>
            }
          >
            <RebootTable rows={enrichedRows as RebootRow[]} columns={enrichedColumns} />
          </CortecaCard>
        </>
      )}
    </CortecaPage>
  );
}
