import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseGetResp } from '@/web/lib/corteca/usp';
import { associationStandard, type AssociationStandard } from '@/web/lib/wifiAssociation';

// WiFi standard of each wireless backhaul in a home network. MCP only reports the
// band; the gateway's EasyMesh Data Elements keep the association request each
// child Beacon's backhaul station sent, which shows the generation negotiated.

export const maxDuration = 60;

/** Keyed by the child Beacon's backhaul station MAC ("aa:bb:cc:dd:ee:ff", lowercase). */
export type BackhaulStandards = Record<string, AssociationStandard>;

const DE = 'Device.WiFi.DataElements.Network.Device.';
// Only the two values needed; the full Data Elements tree is 300–550 KB.
const NARROW = [`${DE}*.Radio.*.BSS.*.STA.*.MACAddress`, `${DE}*.Radio.*.BSS.*.STA.*.ClientCapabilities`, `${DE}*.Radio.*.BackhaulSta.MACAddress`];

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
  const get = (paths: string[]) => uspPost(baseUrl, endpointId, gatewayMac, authHeaders, {
    header: { msgId: 'backhaul-standard', msgType: 'GET' },
    body: { request: { get: { param_paths: paths } } },
  });

  let result = await get(NARROW);
  let flat = result.ok ? parseGetResp((result.json as Record<string, unknown>)?.body) : {};
  // Gateways that reject search paths get the whole tree instead.
  if (!Object.keys(flat).some((k) => k.endsWith('.ClientCapabilities'))) {
    result = await get([DE]);
    flat = result.ok ? parseGetResp((result.json as Record<string, unknown>)?.body) : {};
  }
  if (!result.ok) {
    return NextResponse.json({ error: `Gateway Data Elements unavailable (HTTP ${result.status})` }, { status: 502 });
  }

  const backhaulStas = new Set(
    Object.entries(flat).filter(([k]) => k.endsWith('.BackhaulSta.MACAddress')).map(([, v]) => v.toLowerCase()),
  );
  const standards: BackhaulStandards = {};
  for (const [path, mac] of Object.entries(flat)) {
    if (!/\.BSS\.\d+\.STA\.\d+\.MACAddress$/.test(path) || !backhaulStas.has(mac.toLowerCase())) continue;
    const caps = flat[path.replace(/MACAddress$/, 'ClientCapabilities')];
    const std = caps ? associationStandard(caps) : null;
    if (std) standards[mac.toLowerCase()] = std;
  }

  console.log(`[backhaul-standard:${gatewayMac}] ${backhaulStas.size} backhaul stations, ${Object.keys(standards).length} decoded`);
  return NextResponse.json({ standards });
}
