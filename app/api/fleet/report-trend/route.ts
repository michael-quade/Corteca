import { NextRequest, NextResponse } from "next/server";
import { isTrendType } from "@/web/lib/fleet/reportTrend";
import { fillReportTrends } from "@/web/lib/fleet/reportTrendFill";

/**
 * Fleet Metrics: per-day totals from Corteca's daily reports, `?types=reboot,cloud_disconnection&days=30`.
 * Days Corteca still lists (the last 7) are downloaded and summarised once; older days come
 * from stored rollups only (null when never stored).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const types = (req.nextUrl.searchParams.get("types") ?? "").split(",").filter(isTrendType);
  if (!types.length) return NextResponse.json({ error: "No report types" }, { status: 400 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 7)));

  try {
    return NextResponse.json(await fillReportTrends(base, token, types, days, 25_000));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
