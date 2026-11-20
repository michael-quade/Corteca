import { NextRequest, NextResponse } from "next/server";
import { cortecaFetch } from "@/web/lib/corteca/cortecaFetch";
import { rankingDates } from "@/web/lib/fleet/fleetTabs";
import { isRankingType, parseRanking, type RankingResponse } from "@/web/lib/fleet/rankings";

/**
 * Fleet Metrics: the worst 100 devices / networks of one Corteca report type over the last
 * `days` (1–30) — `/measures/reports/types/{type}/ranking?from=yyyy-mm-dd&to=yyyy-mm-dd`.
 * Read-only, ~0.3 s. Kept 10 min per type + range per server instance.
 */
const TTL = 10 * 60_000;
const cache = new Map<string, { data: RankingResponse; at: number }>();

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const { type } = await params;
  if (!isRankingType(type)) return NextResponse.json({ error: `Unknown ranking type ${type}` }, { status: 400 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 7)));
  const { from, to } = rankingDates(days);

  const key = `${base}|${type}|${from}|${to}`;
  const hit = cache.get(key);
  if (req.nextUrl.searchParams.get("refresh") !== "1" && hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

  const url = `${base}/measures/reports/types/${type}/ranking?from=${from}&to=${to}&page=0&size=100&shard_id=1`;
  try {
    const res = await cortecaFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }, 30_000);
    if (!res.ok) return NextResponse.json({ error: `Corteca answered ${res.status} for the ${type} ranking` }, { status: 502 });
    const data: RankingResponse = { type, from, to, rows: parseRanking(await res.json()) };
    cache.set(key, { data, at: Date.now() });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
