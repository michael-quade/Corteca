"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/contexts/AuthContext";
import { fetchWithAuth } from "@/web/lib/fetchWithAuth";
import { AlarmTable } from "@/web/components/tables/AlarmTable";
import type { AlarmsResponse, AlarmEntry } from "@/app/api/alarms/route";
import { cn } from "@/web/lib/utils";

const SEVERITIES = ["critical", "major", "minor", "clear"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "border-red-300 bg-red-50 text-red-800 data-[checked]:bg-red-600 data-[checked]:text-white data-[checked]:border-red-600",
  major:    "border-orange-300 bg-orange-50 text-orange-800 data-[checked]:bg-orange-500 data-[checked]:text-white data-[checked]:border-orange-500",
  minor:    "border-amber-300 bg-amber-50 text-amber-800 data-[checked]:bg-amber-500 data-[checked]:text-white data-[checked]:border-amber-500",
  clear:    "border-emerald-300 bg-emerald-50 text-emerald-800 data-[checked]:bg-emerald-600 data-[checked]:text-white data-[checked]:border-emerald-600",
};

const SEVERITY_COUNTS: Record<string, string> = {
  critical: "text-red-700 bg-red-50 border-red-200",
  major:    "text-orange-700 bg-orange-50 border-orange-200",
  minor:    "text-amber-700 bg-amber-50 border-amber-200",
  clear:    "text-emerald-700 bg-emerald-50 border-emerald-200",
};

function toUtcString(localDatetimeValue: string): string {
  if (!localDatetimeValue) return "";
  // datetime-local gives yyyy-MM-ddTHH:mm — append :00 and convert to UTC
  const d = new Date(`${localDatetimeValue}:00`);
  if (isNaN(d.getTime())) return localDatetimeValue.replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

function defaultStart(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function defaultEnd(): string {
  return new Date().toISOString().slice(0, 16);
}

function countBySeverity(alarms: AlarmEntry[]): Record<string, number> {
  return alarms.reduce<Record<string, number>>((acc, a) => {
    const s = (a.severity ?? "unknown").toLowerCase();
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
}

export default function AlarmsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [dateStart, setDateStart] = useState(defaultStart);
  const [dateEnd,   setDateEnd]   = useState(defaultEnd);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(new Set(["critical", "major", "minor"]));
  const [deviceMac, setDeviceMac] = useState("");
  const [customAlarms, setCustomAlarms] = useState(false);

  const [data,    setData]    = useState<AlarmsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isLoading, router]);

  function toggleSeverity(s: Severity) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const canFetch = dateStart !== "" && dateEnd !== "" && selectedSeverities.size > 0;

  function toggleFilter(sev: string) {
    setActiveFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev); else next.add(sev);
      return next;
    });
  }

  const handleFetch = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setError(null);
    setData(null);
    setActiveFilter(new Set());
    try {
      const params = new URLSearchParams({
        date_start: toUtcString(dateStart),
        date_end:   toUtcString(dateEnd),
        severities: Array.from(selectedSeverities).join(","),
      });
      if (deviceMac.trim()) params.set("device_mac", deviceMac.trim());
      params.set("isCustomAlarm", customAlarms ? "True" : "False");

      const res = await fetchWithAuth(`/api/alarms?${params.toString()}`);
      const json = await res.json() as unknown;
      const body = json as Record<string, unknown>;
      if (!res.ok) throw new Error((body.error as string) ?? `Error ${res.status}`);
      setData(json as AlarmsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed.");
    } finally {
      setLoading(false);
    }
  }, [canFetch, dateStart, dateEnd, selectedSeverities, deviceMac]);

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
      </main>
    );
  }
  if (!isAuthenticated) return null;

  const counts = data ? countBySeverity(data.alarms) : null;

  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8">
      {/* Back */}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-900">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 8H3M7 4l-4 4 4 4" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Network Alarms</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Query open alarms across the fleet via the ouife fault manager.
          Times are converted to UTC before submission.
        </p>
      </div>

      {/* Query form */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Query Parameters</h2>
        <div className="flex flex-wrap gap-5">

          {/* date_start */}
          <div className="flex min-w-[200px] flex-col gap-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-neutral-700">
              Start Date/Time <span className="text-red-500">*</span>
              <span className="font-normal text-neutral-400">(UTC)</span>
            </label>
            <input
              type="datetime-local"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {/* date_end */}
          <div className="flex min-w-[200px] flex-col gap-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-neutral-700">
              End Date/Time <span className="text-red-500">*</span>
              <span className="font-normal text-neutral-400">(UTC)</span>
            </label>
            <input
              type="datetime-local"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {/* severities */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-xs font-medium text-neutral-700">
              Severity <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((s) => {
                const checked = selectedSeverities.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    data-checked={checked ? "" : undefined}
                    onClick={() => toggleSeverity(s)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                      SEVERITY_COLORS[s],
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* device_mac (optional) */}
          <div className="flex min-w-[220px] flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-700">
              Device MAC <span className="font-normal text-neutral-400">(optional filter)</span>
            </label>
            <input
              type="text"
              placeholder="AA-BB-CC-DD-EE-FF"
              value={deviceMac}
              onChange={(e) => setDeviceMac(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm placeholder:font-sans placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {/* isCustomAlarm */}
          <div className="flex flex-col justify-end gap-1.5">
            <span className="text-xs font-medium text-neutral-700">Alarm Type</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 hover:bg-neutral-100">
              <input
                type="checkbox"
                checked={customAlarms}
                onChange={(e) => setCustomAlarms(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 accent-neutral-800"
              />
              <span className="text-sm text-neutral-700">Custom alarms only</span>
            </label>
          </div>
        </div>

        {/* Validation hint */}
        {!canFetch && (
          <p className="mt-3 text-xs text-amber-600">
            Start date, end date, and at least one severity are required.
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleFetch()}
            disabled={!canFetch || loading}
            className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Fetching…</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7" cy="7" r="5"/><path d="m13 13-3-3"/>
                </svg>
                Fetch Alarms
              </>
            )}
          </button>
          {data && !loading && (
            <span className="text-xs text-neutral-400">
              {data.total} result{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="mt-1 font-mono text-xs text-red-500">{error}</p>
        </div>
      )}

      {/* Summary chips — click to filter table */}
      {counts && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400">Filter:</span>
          {Object.entries(counts)
            .sort(([a], [b]) => {
              const order = ["critical", "major", "minor", "clear"];
              return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99);
            })
            .map(([sev, count]) => {
              const isActive = activeFilter.has(sev);
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleFilter(sev)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-all",
                    isActive
                      ? (SEVERITY_COUNTS[sev] ?? "bg-neutral-700 text-white border-neutral-700") + " ring-2 ring-offset-1 ring-current"
                      : (SEVERITY_COUNTS[sev] ?? "bg-neutral-100 text-neutral-600 border-neutral-200") + " opacity-60 hover:opacity-100",
                  )}
                  title={isActive ? `Remove ${sev} filter` : `Show only ${sev}`}
                >
                  {count} {sev}
                </button>
              );
            })}
          {activeFilter.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter(new Set())}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Results table */}
      {data && (
        <div className="flex min-h-0 flex-1 flex-col" style={{ minHeight: "400px" }}>
          <AlarmTable alarms={data.alarms} severityFilter={activeFilter} />
        </div>
      )}
    </main>
  );
}
