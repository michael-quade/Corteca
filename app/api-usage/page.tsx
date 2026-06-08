"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { useApiStats } from "@/web/contexts/ApiStatsContext";
import { loadSessions, aggregateSessions } from "@/web/lib/sessionHistory";
import type { SessionRecord, Period } from "@/web/lib/sessionHistory";
import { UsageChart } from "@/web/components/UsageChart";
import { SessionTable } from "@/web/components/tables/SessionTable";
import { cn } from "@/web/lib/utils";

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} KB`;
  return `${n} B`;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "Daily",   value: "day"   },
  { label: "Weekly",  value: "week"  },
  { label: "Monthly", value: "month" },
  { label: "Yearly",  value: "year"  },
];

export default function ApiUsagePage() {
  const { isAuthenticated }     = useAuth();
  const live                    = useApiStats();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [period, setPeriod]     = useState<Period>("day");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json() as SessionRecord[];
        // Fall back to localStorage if DB returns empty (local dev or first run)
        setSessions(data.length > 0 ? data : loadSessions());
        return;
      }
    } catch { /* fall through */ }
    setSessions(loadSessions());
  }, []);

  // Refresh on mount and every 5 s; also re-run whenever live stats tick so
  // the chart stays current between DB flushes
  useEffect(() => {
    fetchSessions();
    const t = setInterval(fetchSessions, 5_000);
    return () => clearInterval(t);
  }, [fetchSessions, live]);

  // Overlay live stats onto the active session so the table shows real-time values
  const merged = useMemo<SessionRecord[]>(() => sessions.map((s) =>
    !s.endTime
      ? { ...s, calls: live.calls, bytesSent: live.bytesSent, bytesReceived: live.bytesReceived, rateLimitHits: live.rateLimitHits }
      : s
  ), [sessions, live]);

  const buckets = useMemo(() => aggregateSessions(merged, period), [merged, period]);

  const totals = useMemo(() => merged.reduce(
    (acc, s) => ({ calls: acc.calls + s.calls, bytesSent: acc.bytesSent + s.bytesSent, bytesReceived: acc.bytesReceived + s.bytesReceived }),
    { calls: 0, bytesSent: 0, bytesReceived: 0 }
  ), [merged]);

  if (!isAuthenticated) return (
    <main className="flex items-center justify-center py-32 text-neutral-400">Sign in to view API usage history.</main>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">API Usage History</h1>
          <p className="mt-1 text-sm text-neutral-500">{merged.length} authentication sessions recorded across all time</p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)}
              className={cn("rounded-md px-3 py-1.5 text-sm transition-colors",
                period === p.value ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              )}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Sessions",     value: merged.length,                      sub: "auth events",   color: "text-violet-600" },
          { label: "Total API Calls",    value: totals.calls.toLocaleString(),       sub: "requests",      color: "text-blue-600"   },
          { label: "Total Bytes Sent",   value: fmtBytes(totals.bytesSent),          sub: "to Corteca",    color: "text-orange-500" },
          { label: "Total Bytes Recv",   value: fmtBytes(totals.bytesReceived),      sub: "from Corteca",  color: "text-emerald-600"},
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{c.label}</p>
            <p className={cn("mt-1.5 text-2xl font-semibold", c.color)}>{c.value}</p>
            <p className="mt-0.5 text-xs text-neutral-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <UsageChart buckets={buckets} />

      {/* Session table */}
      <SessionTable sessions={merged} />
    </main>
  );
}
