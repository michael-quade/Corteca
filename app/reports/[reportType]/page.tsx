"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/web/contexts/AuthContext";
import { REPORT_CONFIGS } from "@/web/lib/reportTypes";
import { ReportChart, type ReportRow } from "@/web/components/ReportChart";
import { ReportTable } from "@/web/components/tables/ReportTable";

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

  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!config) return;
    if (isLoading || !isAuthenticated) return;
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, reportType]);

  async function fetchReport() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportType}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
    }
  }

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }

  if (!config) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-red-500">Unknown report type: {reportType}</p>
        <Link href="/reports" className="mt-4 inline-block text-sm text-neutral-500 hover:text-neutral-800">
          ← Back
        </Link>
      </main>
    );
  }

  const columns = data ? Object.keys(data.rows[0] ?? {}) : [];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/reports"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>
          <span className="text-neutral-300">|</span>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Dashboard
          </Link>
        </div>

        <button
          type="button"
          onClick={fetchReport}
          disabled={fetching}
          className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={fetching ? "animate-spin" : ""}>
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">{config.displayName}</h1>
        <p className="mt-1 text-sm text-neutral-500">{config.description}</p>
        {data?.meta && (
          <p className="mt-1 font-mono text-xs text-neutral-400">
            Period: {data.meta.start.slice(0, 10)} → {data.meta.end.slice(0, 10)}
            &nbsp;·&nbsp;Report ID: {data.meta.reportId}
          </p>
        )}
      </div>

      {fetching && !data && (
        <div className="flex min-h-[300px] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-8">
          <ReportChart rows={data.rows} config={config} dateRange={{ start: data.meta.start, end: data.meta.end }} />
          <ReportTable rows={data.rows} columns={columns} />
        </div>
      )}
    </main>
  );
}
