import { NextRequest, NextResponse } from "next/server";
import { serviceToken } from "@/web/lib/corteca/serviceToken";
import { fillHours } from "@/web/lib/fleet/hourlySources";
import { TREND_TYPES } from "@/web/lib/fleet/reportTrend";
import { fillReportTrends } from "@/web/lib/fleet/reportTrendFill";

/**
 * Daily Vercel cron (vercel.json, 03:00 UTC): fills Fleet Metrics rollups so the page opens
 * fast — the last 48 h of cluster alarms and events (or `?days=` up to 30 to backfill) and the
 * daily report summaries Corteca still lists (last 7 days). Only Vercel may call it:
 * `Authorization: Bearer $CRON_SECRET`. Read-only towards Corteca; logs in with the service
 * account (CORTECA_SERVICE_USERNAME / _PASSWORD). The site gate lets /api/cron/* through.
 */
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const days = Math.min(30, Math.max(2, Math.round(Number(req.nextUrl.searchParams.get("days")) || 2)));
  const started = Date.now();
  let token: string;
  try { token = await serviceToken(); } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const [alarms, events] = await Promise.all([
    fillHours("alarms", base, token, days, 150_000, 4),
    fillHours("events", base, token, days, 150_000, 4),
  ]);
  const reports = await fillReportTrends(base, token, [...TREND_TYPES], 7, Math.max(20_000, 270_000 - (Date.now() - started)));

  const summary = {
    seconds: Math.round((Date.now() - started) / 1000),
    alarms: { hours: alarms.total, pending: alarms.pending, errors: alarms.errors },
    events: { hours: events.total, pending: events.pending, errors: events.errors },
    reports: { days: reports.total, pending: reports.pending, errors: reports.errors },
  };
  console.log("[cron fleet-rollups]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
