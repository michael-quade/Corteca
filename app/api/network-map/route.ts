import { NextRequest, NextResponse } from 'next/server';
import {
  getReportCache, setReportCache,
  type ReportDevice, type ReportCache,
} from '@/web/lib/corteca/reportCache';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { clearNameCache } from '@/web/lib/corteca/nameCache';

export type { ReportDevice };

// ── CSV parser ────────────────────────────────────────────────────────────────

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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const force = req.nextUrl.searchParams.get('force') === 'true';

  // Serve from cache (forever) unless force=true
  const cached = getReportCache();
  if (!force && cached) {
    console.log(`[network-map] serving cached report (age: ${Math.round((Date.now() - cached.cachedAt) / 60_000)}m)`);
    return NextResponse.json({ ...cached });
  }

  // Fresh report requested — clear dependent caches
  if (force) clearNameCache();

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // 1. Generate deployment report
  const genRes = await cortecaFetch(`${baseUrl}/device-management/reports/deployment/generate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ deployment_report: { never_connected: false }, app_report: {} }),
  });
  if (!genRes.ok) return NextResponse.json({ error: 'Failed to generate deployment report' }, { status: 502 });

  const genData = await genRes.json().catch(() => null) as Record<string, unknown> | null;
  const reportId = genData?.id ?? genData?.report_id ?? (genData as Record<string,unknown>)?.data;
  if (!reportId) return NextResponse.json({ error: 'No report ID in response' }, { status: 502 });

  // 2. Download CSV (with retries)
  let csvText: string | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const dlRes = await cortecaFetch(`${baseUrl}/device-management/reports/${reportId}/download_report`, { headers: authHeaders });
      if (dlRes.ok) { csvText = await dlRes.text(); break; }
    } catch { /* retry */ }
  }
  if (!csvText) return NextResponse.json({ error: 'Failed to download report CSV' }, { status: 502 });

  // 3. Parse CSV — build serial→endpointId map for ALL rows, then dedup by Home WiFi ID
  const { headers, rows } = parseCSV(csvText);
  const seen = new Set<string>();
  const devices: ReportDevice[] = [];
  const uspSerialMap = new Map<string, string>();

  for (const row of rows) {
    const mac          = (row['Home WiFi ID'] || row['MAC'] || '').trim();
    const serialNumber = row['Serial Number'] ?? row['Serial'] ?? row['SN'] ?? row['Device Serial'] ?? '';
    const uspEndpointId = row['USP Endpoint ID'] ?? row['Endpoint ID'] ?? row['USP EID'] ?? '';

    // Populate serial lookup for every row (mesh APs share the same Home WiFi ID)
    if (serialNumber && uspEndpointId) uspSerialMap.set(serialNumber, uspEndpointId);

    if (!mac || seen.has(mac)) continue;
    seen.add(mac);
    devices.push({
      mac, serialNumber, uspEndpointId,
      online:     row['Online status']?.toLowerCase() === 'true',
      model:      row['Model Name'] ?? '',
      firmware:   row['Firmware version'] ?? '',
      customerId: row['Customer ID'] ?? '',
    });
  }

  const online  = devices.filter((d) => d.online).length;
  const offline = devices.length - online;
  const cachedAt = Date.now();
  console.log(`[network-map] fresh report ${reportId}: ${devices.length} networks, ${uspSerialMap.size} devices with USP EIDs`);

  const newCache: ReportCache = { devices, headers, rawRows: rows, stats: { total: devices.length, online, offline }, cachedAt };
  setReportCache(newCache, uspSerialMap);

  return NextResponse.json({ devices, headers, rawRows: rows, stats: { total: devices.length, online, offline }, cachedAt });
}
