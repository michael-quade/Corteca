import { NextRequest, NextResponse } from "next/server";
import { cortecaJson, mapLimited, readAllPages } from "@/web/lib/fleet/cortecaRead";
import {
  appActivity, groupApps, parseClaimable, parseFailedClaims, parseUnauthenticated,
  type AppRow, type OnboardingResponse,
} from "@/web/lib/fleet/onboarding";

/** Fleet Metrics → Onboarding & apps. Read-only; ~20 small calls (two per container app). */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });
  const days = Math.min(30, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("days")) || 7)));
  const sinceDay = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const errors: string[] = [];
  const soft = async <T,>(what: string, p: Promise<T>): Promise<T | null> => {
    try { return await p; } catch (e) { errors.push(`${what}: ${e instanceof Error ? e.message : String(e)}`); return null; }
  };

  const [claims, claimable, unauth, containers] = await Promise.all([
    soft("Failed claims", readAllPages<unknown>(base, token, "/subscribers/failed_claims")),
    soft("Claimable WiFi points", readAllPages<unknown>(base, token, "/subscribers/claimable_devices")),
    soft("Unauthenticated WiFi points", readAllPages<unknown>(base, token, "/device-provisioning/failed_devices")),
    soft("Container apps", cortecaJson<unknown[]>(base, token, "/container-management/containers")),
  ]);

  const grouped = groupApps(Array.isArray(containers) ? containers : []);
  const withCounts = await mapLimited(grouped, 6, Date.now() + 40_000, async (app): Promise<AppRow> => {
    const [counts, trend] = await Promise.all([
      soft(`Installs of ${app.name}`, cortecaJson<{ installed?: number; uninstalled?: number }>(base, token, `/container-management/containers/${app.uuid}/counts`)),
      soft(`Trend of ${app.name}`, cortecaJson(base, token, `/container-management/containers/${app.uuid}/trends?page=0&size=200`)),
    ]);
    return { ...app, installed: counts?.installed ?? null, uninstalled: counts?.uninstalled ?? null, ...appActivity(trend, sinceDay) };
  });

  const body: OnboardingResponse = {
    failedClaims: parseFailedClaims(claims?.items ?? []),
    claimable: parseClaimable(claimable?.items ?? []),
    claimableCapped: !!claimable?.capped,
    unauthenticated: parseUnauthenticated(unauth?.items ?? []),
    unauthenticatedCapped: !!unauth?.capped,
    apps: withCounts.flatMap((r) => (r.result ? [r.result] : [])).sort((a, b) => (b.installed ?? 0) - (a.installed ?? 0)),
    errors: [...new Set(errors)].slice(0, 6),
  };
  return NextResponse.json(body);
}
