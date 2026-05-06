import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

export interface NetworkDeviceInfo {
  aps: { model: string; count: number }[];
  clientCount: number;
}

const infoCache = new Map<string, { data: NetworkDeviceInfo; ts: number }>();
const INFO_TTL  = 10 * 60_000; // 10 minutes

async function safeFetch(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await cortecaFetch(url, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
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

function extractModelName(params: Record<string, string>): string {
  for (const [k, v] of Object.entries(params)) {
    if (k.includes('DeviceInfo') && k.endsWith('ModelName') && v.trim()) return v.trim();
  }
  return '';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { mac: string } },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { mac } = params;

  const cached = infoCache.get(mac);
  if (cached && Date.now() - cached.ts < INFO_TTL) return NextResponse.json(cached.data);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [topology, members] = await Promise.all([
    safeFetch(`${baseUrl}/homehub/networks/${mac}/topology?skip_virtual_node=true`, authHeaders),
    safeFetch(`${baseUrl}/homehub/networks/${mac}/members?read_all_ssid=false&live=true&page=0&size=1000`, authHeaders),
  ]);

  const deviceIds = extractDeviceIds(topology);
  const idsToQuery = deviceIds.length > 0 ? deviceIds : [mac];

  const configs = await Promise.all(
    idsToQuery.map((id) => safeFetch(`${baseUrl}/device-management/devices/${id}/config`, authHeaders)),
  );

  const modelCounts = new Map<string, number>();
  for (const cfg of configs) {
    if (!cfg) continue;
    const cfgParams = (cfg as Record<string, unknown>)?.params as Record<string, string> | undefined;
    const model = (cfgParams ? extractModelName(cfgParams) : '') || 'Unknown';
    modelCounts.set(model, (modelCounts.get(model) ?? 0) + 1);
  }
  const aps = [...modelCounts.entries()].map(([model, count]) => ({ model, count }));

  const memberArr = Array.isArray(members) ? members
    : Array.isArray((members as Record<string, unknown>)?.content)
      ? (members as { content: unknown[] }).content
      : [];
  const clientCount = memberArr.length;

  const data: NetworkDeviceInfo = { aps, clientCount };
  infoCache.set(mac, { data, ts: Date.now() });
  console.log(`[device-info:${mac}] ${aps.map((a) => `${a.count}×${a.model}`).join(', ')} | ${clientCount} clients`);

  return NextResponse.json(data);
}
