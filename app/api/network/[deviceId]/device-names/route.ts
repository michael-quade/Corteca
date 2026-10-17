import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseGetResp } from '@/web/lib/corteca/usp';

// User-given names (and device identity) for a home network, read from the
// gateway's own data model: Device.X_ALU-COM_LAN_DEVICE_MAP.DeviceMap.{i}.
// This is where the Corteca console's Beacon/client nicknames live — they are
// not in MCP or the topology/members endpoints.

export const maxDuration = 60;

export interface DeviceNameEntry {
  mac: string;            // "80-AB-4D-D1-08-30"
  alias: string;          // user-given name ("MBR", "TV Living Room"), or ""
  hostName: string;
  category: string;       // e.g. "WIFI_EXTENDER", "TV", "PC"
  manufacturer: string;
  model: string;
}

const MAP = 'Device.X_ALU-COM_LAN_DEVICE_MAP.DeviceMap.';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { deviceId } = await params;
  const gatewayMac = decodeURIComponent(deviceId).toUpperCase().replace(/:/g, '-');
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const endpointId = await resolveUspEndpointId(gatewayMac, baseUrl, authHeaders);
  const result = await uspPost(baseUrl, endpointId, gatewayMac, authHeaders, {
    header: { msgId: 'device-names', msgType: 'GET' },
    body: { request: { get: { param_paths: [MAP] } } },
  });
  if (!result.ok) {
    return NextResponse.json({ error: `Gateway device map unavailable (HTTP ${result.status})` }, { status: 502 });
  }

  // Group flat "…DeviceMap.<n>.<Param>" values by instance.
  const flat = parseGetResp((result.json as Record<string, unknown>)?.body);
  const byInstance = new Map<string, Record<string, string>>();
  for (const [path, value] of Object.entries(flat)) {
    if (!path.startsWith(MAP)) continue;
    const [instance, param] = path.slice(MAP.length).split('.');
    if (!instance || !param) continue;
    byInstance.set(instance, { ...(byInstance.get(instance) ?? {}), [param]: value });
  }

  const devices: DeviceNameEntry[] = [];
  for (const p of byInstance.values()) {
    const mac = (p.MACAddress ?? '').toUpperCase().replace(/:/g, '-');
    if (!mac) continue;
    devices.push({
      mac,
      alias: (p.HostAlias ?? '').trim(),
      hostName: (p.HostName ?? '').trim(),
      category: p.DeviceCategory ?? '',
      manufacturer: (p.Manufacturer ?? '').trim(),
      model: (p.ModelName ?? '').trim(),
    });
  }

  console.log(`[device-names:${gatewayMac}] ${devices.length} devices, ${devices.filter((d) => d.alias).length} with a user alias`);
  return NextResponse.json({ devices });
}
