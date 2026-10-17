"use client";

import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { REPORT_CONFIGS } from "@/web/lib/reportTypes";
import { ReportChart, type ReportRow } from "@/web/components/ReportChart";
import { ReportTable } from "@/web/components/tables/ReportTable";
import { findDeviceIdInfo, injectAccountNames } from "@/web/lib/reportNameEnrichment";
import { CortecaPage, CortecaLoading } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { OutlineButton } from "@/web/components/corteca/OutlineButton";
import { Notice } from "@/web/components/corteca/Notice";

const NAME_BATCH = 50;

interface ReportMeta {
  reportId: string;
  type: string;
  start: string;
  end: string;
}

interface ReportData {
  rows: ReportRow[];
  meta: ReportMeta;
}

export default function ReportPage() {
  const params = useParams();
  const reportType = params.reportType as string;
  const config = REPORT_CONFIGS[reportType];

  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [data, setData]           = useState<ReportData | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [fetching, setFetching]   = useState(false);
  const [accountNames, setAccountNames] = useState<Map<string, string>>(new Map());
  const [loadingNames, setLoadingNames] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!config) return;
    if (isLoading || !isAuthenticated) return;
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, reportType]);

  // Fetch account names whenever report data arrives
  useEffect(() => {
    if (!data || !isAuthenticated) return;
    const rows = data.rows as Record<string, string>[];
    const idInfo = findDeviceIdInfo(rows);
    if (!idInfo) return;

    const uniqueIds = [...new Set(
      rows.map((r) => r[idInfo.col] ? idInfo.normalizeId(r[idInfo.col]) : '').filter(Boolean)
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
  }, [data, isAuthenticated]);

  async function fetchReport() {
    setFetching(true);
    setError(null);
    setAccountNames(new Map());
    try {
      const res = await fetchWithAuth(`/api/reports/${reportType}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  }

  const enrichedRows = useMemo(() => {
    if (!data) return [];
    const rows = data.rows as Record<string, string>[];
    if (accountNames.size === 0) return rows;
    const idInfo = findDeviceIdInfo(rows);
    if (!idInfo) return rows;
    return injectAccountNames(rows, accountNames, idInfo);
  }, [data, accountNames]);

  const enrichedColumns = useMemo(() => {
    if (!data) return [];
    const base = Object.keys(data.rows[0] ?? {});
    return accountNames.size > 0 ? ['Account Name', ...base] : base;
  }, [data, accountNames]);

  if (isLoading || !isAuthenticated) return <CortecaLoading />;

  if (!config) {
    return (
      <CortecaPage title="Unknown report" crumbs={[{ label: "Performance Reports", href: "/reports" }]}>
        <Notice tone="error" title={`Unknown report type: ${reportType}`} />
      </CortecaPage>
    );
  }

  return (
    <CortecaPage
      title={config.displayName}
      crumbs={[{ label: "Performance Reports", href: "/reports" }]}
      meta={
        <>
          {config.description}
          {data?.meta && (
            <span className="ml-2 font-mono text-neutral-400">
              Period {data.meta.start.slice(0, 10)} → {data.meta.end.slice(0, 10)} · Report ID {data.meta.reportId}
            </span>
          )}
        </>
      }
      actions={
        <OutlineButton
          onClick={fetchReport}
          disabled={fetching}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={fetching ? "animate-spin" : ""}>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          }
        >
          Refresh
        </OutlineButton>
      }
    >
      {fetching && !data && (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl bg-white">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600" />
        </div>
      )}

      {error && <Notice tone="error" title="Couldn't load the report">{error}</Notice>}

      {data && (
        <>
          <ReportChart rows={data.rows} config={config} dateRange={{ start: data.meta.start, end: data.meta.end }} />
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
            <ReportTable rows={enrichedRows as ReportRow[]} columns={enrichedColumns} exportFilename={config.displayName} />
          </CortecaCard>
        </>
      )}
    </CortecaPage>
  );
}
