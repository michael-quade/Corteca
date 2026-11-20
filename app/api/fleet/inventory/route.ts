import { NextRequest, NextResponse } from "next/server";
import { cortecaFetch } from "@/web/lib/corteca/cortecaFetch";
import { parseCsv } from "@/web/lib/fleet/csv";
import { buildInventory, type InventoryResponse } from "@/web/lib/fleet/inventory";

/**
 * Fleet Metrics → Inventory: online / offline per model, how long offline devices have been
 * gone, firmware versions per model, provisioned count. Read-only; four Corteca reads in
 * parallel (~1 s on demo2). Kept 10 min per server instance.
 */
export const maxDuration = 60;

const TTL = 10 * 60_000;
let cached: { data: InventoryResponse; at: number; base: string } | null = null;

async function readJson(url: string, headers: Record<string, string>, label: string, warnings: string[]): Promise<unknown> {
  try {
    const res = await cortecaFetch(url, { headers }, 30_000);
    if (!res.ok) { warnings.push(`${label}: Corteca answered ${res.status}`); return null; }
    return await res.json();
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("corteca_token")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const base = process.env.CORTECA_API_BASE_URL;
  if (!base) return NextResponse.json({ error: "API not configured" }, { status: 503 });

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  if (!force && cached && cached.base === base && Date.now() - cached.at < TTL) return NextResponse.json(cached.data);

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const warnings: string[] = [];

  const [stats, firmwares, prov, offlineRows] = await Promise.all([
    readJson(`${base}/device-management/stats`, headers, "Device stats", warnings),
    readJson(`${base}/device-management/firmwares`, headers, "Firmware list", warnings),
    readJson(`${base}/device-provisioning/devices/`, headers, "Provisioned count", warnings),
    (async () => {
      try {
        const res = await cortecaFetch(`${base}/device-management/reports/devicestatus/download?online=False`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "text/csv, */*" } }, 45_000);
        if (!res.ok) { warnings.push(`Offline device list: Corteca answered ${res.status}`); return null; }
        return parseCsv(await res.text()).rows;
      } catch (e) {
        warnings.push(`Offline device list: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    })(),
  ]);

  if (stats == null) return NextResponse.json({ error: warnings.join(" · ") || "Couldn't read device stats" }, { status: 502 });

  const provCount = Number((prov as { device_count?: unknown } | null)?.device_count);
  const data = buildInventory(stats, offlineRows, firmwares, Number.isFinite(provCount) ? provCount : null, warnings);
  if (!warnings.length) cached = { data, at: Date.now(), base };
  return NextResponse.json(data);
}
