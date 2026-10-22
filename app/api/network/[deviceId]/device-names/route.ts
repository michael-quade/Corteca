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

// ── Rename ────────────────────────────────────────────────────────────────────
// Sets HostAlias for one device in the gateway's device map (the nickname the
// Corteca console and app show). Empty alias removes the nickname. The SET reply
// can be HTTP 200 even when the gateway rejects it, so the value is read back.

const MAX_ALIAS = 64;
const normMac = (m: string) => m.toUpperCase().replace(/[:\-]/g, '');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { mac?: unknown; alias?: unknown } | null;
  const mac = typeof body?.mac === 'string' ? body.mac : '';
  const alias = typeof body?.alias === 'string' ? body.alias.replace(/[\u0000-\u001f\u007f]/g, '').trim() : null;
  if (!/^[0-9A-Fa-f]{2}([:-]?[0-9A-Fa-f]{2}){5}$/.test(mac) || alias === null) {
    return NextResponse.json({ error: 'mac and alias are required' }, { status: 400 });
  }
  if (alias.length > MAX_ALIAS) {
    return NextResponse.json({ error: `Names can be at most ${MAX_ALIAS} characters` }, { status: 400 });
  }

  const { deviceId } = await params;
  const gatewayMac = decodeURIComponent(deviceId).toUpperCase().replace(/:/g, '-');
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const endpointId = await resolveUspEndpointId(gatewayMac, baseUrl, authHeaders);
  const usp = (msgType: 'GET' | 'SET', request: Record<string, unknown>) =>
    uspPost(baseUrl, endpointId, gatewayMac, authHeaders, { header: { msgId: `rename-${Date.now()}`, msgType }, body: { request } });

  // Find the device's DeviceMap instance.
  const map = await usp('GET', { get: { param_paths: [`${MAP}*.MACAddress`] } });
  if (!map.ok) return NextResponse.json({ error: `Gateway device map unavailable (HTTP ${map.status})` }, { status: 502 });
  const flat = parseGetResp((map.json as Record<string, unknown>)?.body);
  const instance = Object.entries(flat).find(([p, v]) => p.endsWith('.MACAddress') && normMac(v) === normMac(mac))?.[0]
    ?.slice(MAP.length).split('.')[0];
  if (!instance) {
    return NextResponse.json({ error: "This device isn't in the gateway's device list, so it can't be renamed" }, { status: 404 });
  }

  const objPath = `${MAP}${instance}.`;
  const set = await usp('SET', {
    set: { allowPartial: false, updateObjs: [{ objPath, paramSettings: [{ param: 'HostAlias', value: alias, required: true }] }] },
  });
  if (!set.ok) {
    const msg = (set.json as Record<string, unknown>)?.message ?? `HTTP ${set.status}`;
    console.warn(`[device-names:${gatewayMac}] rename ${mac} failed: ${msg}`);
    return NextResponse.json({ error: `The gateway rejected the change (${msg})` }, { status: 502 });
  }

  const check = await usp('GET', { get: { param_paths: [`${objPath}HostAlias`] } });
  const saved = check.ok ? parseGetResp((check.json as Record<string, unknown>)?.body)[`${objPath}HostAlias`] : undefined;
  if (saved === undefined || saved.trim() !== alias) {
    console.warn(`[device-names:${gatewayMac}] rename ${mac}: read back "${saved}" instead of "${alias}"`);
    return NextResponse.json({ error: "The gateway didn't keep the new name. Try again, or check the device in the Corteca console." }, { status: 502 });
  }

  console.log(`[device-names:${gatewayMac}] renamed ${mac} → "${alias}" (DeviceMap.${instance})`);
  return NextResponse.json({ mac: mac.toUpperCase().replace(/:/g, '-'), alias: saved.trim() });
}
