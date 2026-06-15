import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

async function safeFetch(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await cortecaFetch(url, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function extractDeviceIds(data: unknown, ids = new Set<string>()): string[] {
  if (!data || typeof data !== 'object') return [...ids];
  if (Array.isArray(data)) { data.forEach((item) => extractDeviceIds(item, ids)); return [...ids]; }
  const n = data as Record<string, unknown>;
  if (typeof n.device_id === 'string' && n.device_id) ids.add(n.device_id);
  if (Array.isArray(n.children)) {
    n.children.forEach((c) => typeof c === 'string' ? ids.add(c) : extractDeviceIds(c, ids));
  }
  return [...ids];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { deviceId } = await params;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // Three parallel topology fetches
  const [networks, topology, mesh] = await Promise.all([
    safeFetch(`${baseUrl}/homehub/networks?device_id=${deviceId}&skip_virtual_node=false`, headers),
    safeFetch(`${baseUrl}/homehub/networks/${deviceId}/topology?skip_virtual_node=true`, headers),
    safeFetch(`${baseUrl}/homehub/networks/${deviceId}/mesh?live=true`, headers),
  ]);

  if (!topology && !networks) {
    return NextResponse.json({ error: 'No network data returned for this device.' }, { status: 404 });
  }

  // Fetch device configs, members, and location summary in parallel
  const deviceIds = extractDeviceIds(topology ?? networks);
  const [members, summary, ...configResults] = await Promise.all([
    safeFetch(
      `${baseUrl}/homehub/networks/${deviceId}/members?read_all_ssid=false&live=true&page=0&size=1000`,
      headers
    ),
    safeFetch(`${baseUrl}/ouife/devices/${deviceId}/summary/ouifeapi`, headers),
    ...deviceIds.map((id) =>
      safeFetch(`${baseUrl}/device-management/devices/${id}/config`, headers)
        .then((cfg) => [id, cfg] as [string, unknown])
    ),
  ]);

  const configs = Object.fromEntries(
    (configResults as [string, unknown][]).filter(([, v]) => v !== null)
  );

  const memberCount = Array.isArray(members) ? members.length : Array.isArray((members as Record<string,unknown>)?.content) ? (members as {content: unknown[]}).content.length : '?';
  console.log(`[network:${deviceId}] APs: ${deviceIds.length} | members: ${memberCount}`);

  return NextResponse.json({ networks, topology, mesh, configs, members, summary, rootDeviceId: deviceId });
}
