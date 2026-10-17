"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/web/contexts/AuthContext";
import { useApiStats } from "@/web/contexts/ApiStatsContext";
import { loadSessions, aggregateSessions } from "@/web/lib/sessionHistory";
import type { SessionRecord, Period } from "@/web/lib/sessionHistory";
import { UsageChart } from "@/web/components/UsageChart";
import { SessionTable } from "@/web/components/tables/SessionTable";
import { CortecaPage } from "@/web/components/corteca/CortecaPage";
import { CortecaCard } from "@/web/components/corteca/CortecaCard";
import { HealthTile } from "@/web/components/corteca/HealthTile";
import { SegmentedControl } from "@/web/components/corteca/SegmentedControl";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
);
const SESSIONS = icon("M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3");
const CALLS = icon("M4 19V9M10 19V5M16 19v-7M22 19H2");
const SENT = icon("M12 19V5M5 12l7-7 7 7");
const RECEIVED = icon("M12 5v14M19 12l-7 7-7-7");

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
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#f5f7fa] text-sm text-neutral-500">Sign in to view API usage history.</div>
  );

  return (
    <CortecaPage
      title="API Usage"
      meta={`${merged.length} authentication sessions recorded across all time`}
      actions={<SegmentedControl label="Period" value={period} onChange={setPeriod} options={PERIODS} />}
    >
      <CortecaCard title="Usage summary">
        <div className="grid grid-cols-2 gap-y-4 md:grid-cols-4 md:divide-x md:divide-neutral-200">
          <HealthTile icon={SESSIONS} label="Sessions" value={merged.length.toLocaleString()} sub="auth events" />
          <HealthTile icon={CALLS} label="API calls" value={totals.calls.toLocaleString()} sub="requests" />
          <HealthTile icon={SENT} label="Bytes sent" value={fmtBytes(totals.bytesSent)} sub="to Corteca" />
          <HealthTile icon={RECEIVED} label="Bytes received" value={fmtBytes(totals.bytesReceived)} sub="from Corteca" />
        </div>
      </CortecaCard>

      <UsageChart buckets={buckets} />

      <SessionTable sessions={merged} />
    </CortecaPage>
  );
}
