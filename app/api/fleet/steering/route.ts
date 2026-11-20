import { NextRequest, NextResponse } from "next/server";
import { cortecaGet, ouifeTime } from "@/web/lib/fleet/cortecaRead";
import { parseSteering, summariseSteering, type SteeredClient } from "@/web/lib/fleet/steering";

/**
 * Fleet Metrics → Steering: the clients Corteca steered in the last 24 h (one ~8 MB CSV, ~10 s),
 * parsed once per 15 min per server instance. `days` (1–30) only limits which of their
 * Cs History attempts are counted.
 */
export const maxDuration = 60;

const TTL = 15 * 60_000;
let cached: { at: number; base: string; clients: SteeredClient[]; readAt: string } | null = null;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 7)));

  if (req.nextUrl.searchParams.get("refresh") === "1" || !cached || cached.base !== base || Date.now() - cached.at > TTL) {
    const now = new Date();
    try {
      const csv = await cortecaGet(base, token,
        `/ouife/steering/details/ouifeapi?date_start=${ouifeTime(new Date(now.getTime() - 86_400_000 + 60_000))}&date_end=${ouifeTime(now)}&type=raw`,
        { csv: true, timeoutMs: 55_000 });
      cached = { at: Date.now(), base, clients: parseSteering(csv), readAt: now.toISOString() };
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }
  return NextResponse.json(summariseSteering(cached.clients, days, cached.readAt));
}
