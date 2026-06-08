// Shared deployment-report fetch + cache logic.
// Called by both /api/network-map (on demand / force) and /api/sw-overview (auto if stale).

import { cortecaFetch } from './cortecaFetch';
import {
  getReportCache, setReportCache, hydrateFromDb, persistToDb,
  type ReportDevice, type ReportCache,
} from './reportCache';

export const REPORT_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

export type FetchReportResult = { ok: true } | { ok: false; error: string };

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
      else cur += c;
    }
    fields.push(cur);
    return fields;
  }

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const vals = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
  return { headers, rows };
}

/**
 * Ensures the deployment report cache is populated and fresh.
 * - If force=true, always re-fetches regardless of age.
 * - Otherwise, re-fetches only when cache is absent or older than maxAgeMs.
 * Returns { ok: true } if cache is now ready, { ok: false, error } on failure.
 */
export async function ensureDeploymentReport(
  baseUrl: string,
  authHeaders: Record<string, string>,
  { force = false, maxAgeMs = REPORT_MAX_AGE_MS }: { force?: boolean; maxAgeMs?: number } = {},
): Promise<FetchReportResult> {
  // On cold start, try to warm the in-memory cache from DB before checking staleness
  if (!force && !getReportCache()) await hydrateFromDb(maxAgeMs);

  const existing = getReportCache();
  if (!force && existing && (Date.now() - existing.cachedAt) < maxAgeMs) {
    return { ok: true };
  }

  console.log(`[deployment-report] fetching fresh report (force=${force})`);

  // 1. Generate
  const genRes = await cortecaFetch(
    `${baseUrl}/device-management/reports/deployment/generate`,
    {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ deployment_report: { never_connected: false }, app_report: {} }),
    },
  );
  if (!genRes.ok) return { ok: false, error: 'Failed to generate deployment report' };

  const genData = await genRes.json().catch(() => null) as Record<string, unknown> | null;
  const reportId = genData?.id ?? genData?.report_id ?? genData?.data;
  if (!reportId) return { ok: false, error: 'No report ID in generate response' };

  // 2. Download (with retries)
  let csvText: string | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const dlRes = await cortecaFetch(
        `${baseUrl}/device-management/reports/${reportId}/download_report`,
        { headers: authHeaders },
      );
      if (dlRes.ok) { csvText = await dlRes.text(); break; }
    } catch { /* retry */ }
  }
  if (!csvText) return { ok: false, error: 'Failed to download report CSV after retries' };

  // 3. Parse + cache
  const { headers, rows } = parseCSV(csvText);
  const macToIdx = new Map<string, number>();
  const devices: ReportDevice[] = [];
  const uspSerialMap = new Map<string, string>();

  for (const row of rows) {
    const mac          = (row['Home WiFi ID'] || row['MAC'] || '').trim();
    const serialNumber = row['Serial Number'] ?? row['Serial'] ?? row['SN'] ?? row['Device Serial'] ?? '';
    const uspEndpointId = row['USP Endpoint ID'] ?? row['Endpoint ID'] ?? row['USP EID'] ?? '';
    if (serialNumber && uspEndpointId) uspSerialMap.set(serialNumber, uspEndpointId);
    if (!mac) continue;

    if (macToIdx.has(mac)) {
      // Subsequent rows for the same network (mesh APs sharing the same Home WiFi ID).
      // If the stored entry is missing a Customer ID and this row has one, update it
      // so the network is eligible for geolocation.
      const idx = macToIdx.get(mac)!;
      const newCustomerId = (row['Customer ID'] ?? '').trim();
      if (!devices[idx].customerId && newCustomerId) {
        devices[idx] = { ...devices[idx], customerId: newCustomerId };
      }
      continue;
    }

    macToIdx.set(mac, devices.length);
    devices.push({
      mac, serialNumber, uspEndpointId,
      online:     row['Online status']?.toLowerCase() === 'true',
      model:      row['Model Name'] ?? '',
      firmware:   row['Firmware version'] ?? '',
      customerId: (row['Customer ID'] ?? '').trim(),
    });
  }

  const online   = devices.filter((d) => d.online).length;
  const offline  = devices.length - online;
  const cachedAt = Date.now();
  console.log(`[deployment-report] cached report ${reportId}: ${devices.length} networks, ${uspSerialMap.size} USP EIDs`);

  const newCache: ReportCache = {
    devices, headers, rawRows: rows,
    stats: { total: devices.length, online, offline },
    cachedAt,
  };
  setReportCache(newCache, uspSerialMap);
  await persistToDb();
  return { ok: true };
}
