import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseGetResp } from '@/web/lib/corteca/usp';
import { associationStandard } from '@/web/lib/wifiAssociation';
import { labelRadios, parseRadio } from '@/web/lib/wifiRadios';
import type { WifiDetails } from '@/web/lib/wifiDetails';

// WiFi details for a whole home network from the gateway's EasyMesh Data Elements
// (the gateway is the mesh controller, so it reports every Beacon):
//  - radios per AP: channel, width, airtime utilization, noise
//  - WiFi standard of each backhaul and client station, decoded from the
//    association request it sent (MCP only gives the backhaul band)

export const maxDuration = 60;

const DE = 'Device.WiFi.DataElements.Network.Device.';
const R = `${DE}*.Radio.*.`;
// Only what's needed; the full Data Elements tree is 300–550 KB.
const NARROW = [
  `${DE}*.ID`,
  `${R}BSS.*.STA.*.MACAddress`, `${R}BSS.*.STA.*.ClientCapabilities`, `${R}BackhaulSta.MACAddress`,
  ...['Utilization', 'X_ALU-COM_EWMA_Utilization', 'Transmit', 'ReceiveSelf', 'ReceiveOther', 'Noise'].map((p) => `${R}${p}`),
  `${R}CurrentOperatingClassProfile.*.Class`, `${R}CurrentOperatingClassProfile.*.Channel`, `${R}CurrentOperatingClassProfile.*.TxPower`,
];

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
    header: { msgId: 'wifi-details', msgType: 'GET' },
    body: { request: { get: { param_paths: paths } } },
  });

  let result = await get(NARROW);
  let flat = result.ok ? parseGetResp((result.json as Record<string, unknown>)?.body) : {};
  // Gateways that reject search paths get the whole tree instead.
  if (!Object.keys(flat).some((k) => k.endsWith('.ID'))) {
    result = await get([DE]);
    flat = result.ok ? parseGetResp((result.json as Record<string, unknown>)?.body) : {};
  }
  if (!result.ok) {
    return NextResponse.json({ error: `Gateway Data Elements unavailable (HTTP ${result.status})` }, { status: 502 });
  }

  // Group "Device.{d}.Radio.{r}.<rest>" by AP and radio.
  const apMacOf = new Map<string, string>();
  const radioParams = new Map<string, Record<string, string>>();
  for (const [path, value] of Object.entries(flat)) {
    if (!path.startsWith(DE)) continue;
    const m = path.slice(DE.length).match(/^(\d+)\.(?:ID$|Radio\.(\d+)\.(.+)$)/);
    if (!m) continue;
    if (!m[2]) { apMacOf.set(m[1], value.toLowerCase()); continue; }
    const key = `${m[1]}.${m[2]}`;
    radioParams.set(key, { ...(radioParams.get(key) ?? {}), [m[3]]: value });
  }

  const details: WifiDetails = { radios: {}, backhaul: {}, clients: {} };
  for (const [key, p] of radioParams) {
    const ap = apMacOf.get(key.split('.')[0]);
    const radio = ap ? parseRadio(p) : null;
    if (ap && radio) (details.radios[ap] ??= []).push(radio);
  }
  for (const ap of Object.keys(details.radios)) details.radios[ap] = labelRadios(details.radios[ap]);

  const backhaulStas = new Set(
    Object.entries(flat).filter(([k]) => k.endsWith('.BackhaulSta.MACAddress')).map(([, v]) => v.toLowerCase()),
  );
  for (const [path, mac] of Object.entries(flat)) {
    if (!/\.BSS\.\d+\.STA\.\d+\.MACAddress$/.test(path)) continue;
    const caps = flat[path.replace(/MACAddress$/, 'ClientCapabilities')];
    const std = caps ? associationStandard(caps) : null;
    if (!std) continue;
    const target = backhaulStas.has(mac.toLowerCase()) ? details.backhaul : details.clients;
    target[mac.toLowerCase()] = std;
  }

  console.log(`[wifi-details:${gatewayMac}] ${Object.keys(details.radios).length} APs with radios, ${Object.keys(details.backhaul).length} backhaul + ${Object.keys(details.clients).length} client standards`);
  return NextResponse.json(details);
}
