import { NextRequest, NextResponse } from 'next/server';
import { getReportCache } from '@/web/lib/corteca/reportCache';
import { ensureDeploymentReport, REPORT_MAX_AGE_MS } from '@/web/lib/corteca/deploymentReport';
import { getSwMatrix, matchFirmware, deriveRelease } from '@/web/lib/swMatrix';

export interface NetworkSwEntry {
  mac: string;
  online: boolean;
  firmware: string;
  formattedVersion: string;
  deviceModel: string;
  beaconModel: string | null;
  releaseName: string | null;
  customerId: string;
}

export interface UnknownDevice {
  mac: string;
  online: boolean;
  customerId: string;
}

export interface UnknownFirmwareEntry {
  firmware: string;
  total: number;
  online: number;
  models: string[];
  derivedRelease: string | null;
  devices: UnknownDevice[];
}

export interface SwOverviewResponse {
  beaconModels: string[];
  /** raw build string per [releaseName][beaconModel] from the SW Release Matrix */
  buildMatrix: Record<string, Record<string, string>>;
  networks: NetworkSwEntry[];
  unknownFirmwares: UnknownFirmwareEntry[];
  reportAge: number;
  cachedAt: number;
}

export async function GET(req: NextRequest) {
  try {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Auto-fetch when cache is absent or older than 8 hours
  const existing = getReportCache();
  const stale = !existing || (Date.now() - existing.cachedAt) > REPORT_MAX_AGE_MS;
  if (stale) {
    console.log('[sw-overview] cache missing or stale — auto-fetching deployment report');
    const result = await ensureDeploymentReport(baseUrl, authHeaders);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 503 });
  }

  const reportCache = getReportCache()!;
  const matrix = await getSwMatrix();
  const now = Date.now();

  const seen = new Set<string>();
  const networks: NetworkSwEntry[] = [];
  const unknownMap = new Map<string, { total: number; online: number; models: Set<string>; devices: UnknownDevice[] }>();

  for (const row of reportCache.rawRows) {
    const mac    = (row['Home WiFi ID'] || row['MAC'] || '').trim();
    const serial = (row['Serial Number'] || row['Serial'] || row['SN'] || row['Device Serial'] || '').trim();
    // Deduplicate per physical device (serial), falling back to network MAC so
    // mesh APs with their own serial numbers are each counted separately.
    const dedupeKey = serial || mac;
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const firmware = (row['Firmware version'] || row['Firmware Version'] || '').trim();
    const formattedVersion = (
      row['SW version'] || row['Software version'] || row['sw_version'] || row['SW Version'] || ''
    ).trim();
    const deviceModel = (row['Model Name'] || '').trim();
    const customerId = (row['Customer ID'] || '').trim();
    const online = (row['Online status'] || '').toLowerCase() === 'true';

    const match = matchFirmware(firmware, matrix);

    if (match) {
      networks.push({
        mac,
        online,
        firmware,
        formattedVersion,
        deviceModel,
        beaconModel: match.beaconModel,
        releaseName: match.releaseName,
        customerId,
      });
    } else {
      networks.push({
        mac,
        online,
        firmware,
        formattedVersion,
        deviceModel,
        beaconModel: null,
        releaseName: null,
        customerId,
      });

      if (firmware) {
        const entry = unknownMap.get(firmware);
        if (entry) {
          entry.total += 1;
          if (online) entry.online += 1;
          if (deviceModel) entry.models.add(deviceModel);
          entry.devices.push({ mac, online, customerId });
        } else {
          unknownMap.set(firmware, {
            total: 1,
            online: online ? 1 : 0,
            models: new Set(deviceModel ? [deviceModel] : []),
            devices: [{ mac, online, customerId }],
          });
        }
      }
    }
  }

  const unknownFirmwares: UnknownFirmwareEntry[] = Array.from(unknownMap.entries()).map(
    ([firmware, stats]) => ({
      firmware,
      total: stats.total,
      online: stats.online,
      models: Array.from(stats.models),
      derivedRelease: deriveRelease(
        networks.find((n) => n.firmware === firmware)?.formattedVersion ?? '',
      ),
      devices: stats.devices.sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        return a.mac.localeCompare(b.mac);
      }),
    }),
  );

  // Sort unknowns by total desc
  unknownFirmwares.sort((a, b) => b.total - a.total);

  const response: SwOverviewResponse = {
    beaconModels: matrix.beaconModels,
    buildMatrix: matrix.buildsByRelease,
    networks,
    unknownFirmwares,
    reportAge: now - reportCache.cachedAt,
    cachedAt: reportCache.cachedAt,
  };

  return NextResponse.json(response);
  } catch (e) {
    console.error('[sw-overview] unhandled error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
