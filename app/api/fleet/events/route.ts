import { NextRequest, NextResponse } from "next/server";
import { mergeEventHours, type EventHour, type EventsResponse } from "@/web/lib/fleet/clusterEvents";
import { fillHours } from "@/web/lib/fleet/hourlySources";

/**
 * Fleet Metrics → RF & coverage: the radio / configuration changes Corteca logged across the
 * cluster in the last `days` (1–30), from hourly rollups of `/ouife/events`. Same pending /
 * ask-again flow as /api/fleet/alarms.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 1)));

  const fill = await fillHours<EventHour>("events", base, token, days, 20_000);
  const body: EventsResponse = {
    ...mergeEventHours(fill.buckets, days > 1),
    pending: fill.pending, total: fill.total, errors: fill.errors,
  };
  if (!fill.buckets.length && fill.errors.length) return NextResponse.json({ error: fill.errors.join(" · ") }, { status: 502 });
  return NextResponse.json(body);
}
