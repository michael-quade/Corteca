import { NextRequest, NextResponse } from "next/server";
import { mergeAlarmHours, type AlarmHour, type AlarmsResponse } from "@/web/lib/fleet/alarms";
import { fillHours } from "@/web/lib/fleet/hourlySources";

/**
 * Fleet Metrics → Alarms: cluster alarm history for the last `days` (1–30), from hourly
 * rollups. Hours not stored yet are read from Corteca (newest first, ~20 s per call); the
 * answer says how many are `pending`, and the page asks again until none are.
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 1)));

  const fill = await fillHours<AlarmHour>("alarms", base, token, days, 20_000);
  const body: AlarmsResponse = {
    ...mergeAlarmHours(fill.buckets, days > 1),
    pending: fill.pending, total: fill.total, errors: fill.errors,
  };
  body.aps = body.aps.slice(0, 1000);
  if (!fill.buckets.length && fill.errors.length) return NextResponse.json({ error: fill.errors.join(" · ") }, { status: 502 });
  return NextResponse.json(body);
}
