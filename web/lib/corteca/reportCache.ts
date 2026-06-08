// Shared in-memory report cache — survives across API route calls within one
// Next.js server process. Populated by the network-map route; queried by the
// ethernet and USP routes without extra API calls.
//
// When DATABASE_URL is set, the cache is also persisted to Supabase so it
// survives serverless cold-starts and is shared across all instances/users.

export interface ReportDevice {
  mac: string;           // Home WiFi ID (root gateway MAC)
  online: boolean;
  model: string;
  firmware: string;
  customerId: string;
  serialNumber: string;
  uspEndpointId: string;
}

export interface ReportCache {
  devices: ReportDevice[];
  headers: string[];
  rawRows: Record<string, string>[];
  stats: { total: number; online: number; offline: number };
  cachedAt: number;
}

let cache: ReportCache | null = null;
const bySerial = new Map<string, string>(); // serialNumber → uspEndpointId (all devices, pre-dedup)

export function getReportCache(): ReportCache | null { return cache; }

export function setReportCache(c: ReportCache, serialMap: Map<string, string>): void {
  cache = c;
  bySerial.clear();
  for (const [k, v] of serialMap) bySerial.set(k, v);
}

// Look up by root gateway MAC (Home WiFi ID) — used by network-map geolocation
export function lookupUspEndpointId(mac: string): string | null {
  if (!cache) return null;
  const d = cache.devices.find((d) => d.mac === mac);
  return d?.uspEndpointId || d?.serialNumber || null;
}

// Look up by device serial number — covers mesh APs dropped by the MAC dedup
export function lookupUspEndpointIdBySerial(serial: string): string | null {
  return bySerial.get(serial) ?? null;
}

// ── DB persistence ────────────────────────────────────────────────────────────

/** Loads a fresh-enough DB row into the in-memory cache on cold start. */
export async function hydrateFromDb(maxAgeMs: number): Promise<void> {
  if (cache) return; // already warm
  if (!process.env.DATABASE_URL) return;
  try {
    const { prisma } = await import('../prisma');
    const row = await prisma.deploymentReport.findUnique({ where: { id: 1 } });
    if (!row) return;

    const ageMs = Date.now() - row.cachedAt.getTime();
    if (ageMs >= maxAgeMs) {
      console.log('[report-cache] DB data stale, skipping hydration');
      return;
    }

    cache = {
      devices:  row.devices  as ReportDevice[],
      headers:  row.headers  as string[],
      rawRows:  row.rawRows  as Record<string, string>[],
      stats:    row.stats    as { total: number; online: number; offline: number },
      cachedAt: row.cachedAt.getTime(),
    };
    bySerial.clear();
    for (const [k, v] of Object.entries(row.uspMap as Record<string, string>)) {
      bySerial.set(k, v);
    }
    console.log(`[report-cache] hydrated from DB (age: ${Math.round(ageMs / 60_000)}m, ${cache.devices.length} devices)`);
  } catch (e) {
    console.error('[report-cache] DB hydration failed:', e);
  }
}

/** Writes the current in-memory cache to Supabase after a fresh fetch. */
export async function persistToDb(): Promise<void> {
  if (!process.env.DATABASE_URL || !cache) return;
  try {
    const { prisma } = await import('../prisma');
    const uspMap: Record<string, string> = {};
    bySerial.forEach((v, k) => { uspMap[k] = v; });

    const data = {
      devices:  JSON.parse(JSON.stringify(cache.devices)),
      headers:  JSON.parse(JSON.stringify(cache.headers)),
      rawRows:  JSON.parse(JSON.stringify(cache.rawRows)),
      stats:    JSON.parse(JSON.stringify(cache.stats)),
      uspMap:   JSON.parse(JSON.stringify(uspMap)),
      cachedAt: new Date(cache.cachedAt),
    };
    await prisma.deploymentReport.upsert({
      where:  { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
    console.log(`[report-cache] persisted to DB (${cache.devices.length} devices)`);
  } catch (e) {
    console.error('[report-cache] DB persist failed:', e);
  }
}
