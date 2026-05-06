// Shared in-memory report cache — survives across API route calls within one
// Next.js server process. Populated by the network-map route; queried by the
// ethernet and USP routes without extra API calls.

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
