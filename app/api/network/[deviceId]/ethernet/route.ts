import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseGetResp } from '@/web/lib/corteca/usp';

export interface EthernetPort {
  index: number;
  name: string;
  upstream: boolean;
  enable: boolean;
  status: 'Up' | 'Down' | 'Unknown' | 'Dormant' | 'NotPresent' | 'LowerLayerDown' | 'Error';
  maxBitRate: number;
  currentBitRate: number;
  duplexMode: string;
  macAddress: string;
  connectedHost: { hostName: string; ipAddress: string; macAddress: string } | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { deviceId } = await params;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const provided = req.nextUrl.searchParams.get('endpointId');
  const endpointId = provided || await resolveUspEndpointId(deviceId, baseUrl, authHeaders);
  console.log(`[ethernet:${deviceId}] USP EID: ${endpointId}${provided ? ' (caller-supplied)' : ''}`);

  const getMsg = (msgId: string, paths: string[]) => ({
    header: { msgId, msgType: 'GET' },
    body: { request: { get: { param_paths: paths } } },
  });

  const [ifaceResult, hostsResult] = await Promise.all([
    uspPost(baseUrl, endpointId, deviceId, authHeaders, getMsg('eth-iface', ['Device.Ethernet.Interface.'])),
    uspPost(baseUrl, endpointId, deviceId, authHeaders, getMsg('eth-hosts', ['Device.Hosts.Host.'])),
  ]);

  const ifaceData = parseGetResp((ifaceResult.json as Record<string, unknown>)?.body);
  const hostsData = parseGetResp((hostsResult.json as Record<string, unknown>)?.body);

  // Group flat params by object path
  function groupByObject(flat: Record<string, string>, prefix: string): Record<string, Record<string, string>> {
    const grouped: Record<string, Record<string, string>> = {};
    for (const [fullPath, val] of Object.entries(flat)) {
      if (!fullPath.startsWith(prefix)) continue;
      const rest = fullPath.slice(prefix.length);
      const dotIdx = rest.indexOf('.');
      if (dotIdx === -1) continue;
      const instanceAndParam = rest.slice(0, dotIdx + 1);
      const objPath = `${prefix}${instanceAndParam}`;
      const paramName = rest.slice(dotIdx + 1);
      if (!grouped[objPath]) grouped[objPath] = {};
      grouped[objPath][paramName] = val;
    }
    return grouped;
  }

  const ifaceGroups = groupByObject(ifaceData, 'Device.Ethernet.Interface.');
  const hostGroups  = groupByObject(hostsData, 'Device.Hosts.Host.');

  // Build host lookup by Layer1Interface
  const hostByIface: Record<string, EthernetPort['connectedHost']> = {};
  for (const p of Object.values(hostGroups)) {
    const iface = (p.Layer1Interface ?? '').replace(/\.$/, '');
    if (iface && p.Active === 'true') {
      hostByIface[iface] = { hostName: p.HostName ?? '', ipAddress: p.IPAddress ?? '', macAddress: p.PhysAddress ?? '' };
    }
  }

  const ports: EthernetPort[] = [];
  for (const [objPath, p] of Object.entries(ifaceGroups)) {
    const m = objPath.match(/Device\.Ethernet\.Interface\.(\d+)\./);
    if (!m) continue;
    const index = parseInt(m[1], 10);
    ports.push({
      index,
      name:           p.Name       ?? `eth${index - 1}`,
      upstream:       p.Upstream   === 'true',
      enable:         p.Enable     === 'true',
      status:         (p.Status    ?? 'Unknown') as EthernetPort['status'],
      maxBitRate:     parseInt(p.MaxBitRate     ?? '0', 10),
      currentBitRate: parseInt(p.CurrentBitRate ?? '0', 10),
      duplexMode:     p.DuplexMode  ?? '',
      macAddress:     p.MACAddress  ?? '',
      connectedHost:  hostByIface[objPath.replace(/\.$/, '')] ?? null,
    });
  }
  // WAN (upstream) port first, then LAN ports by index
  ports.sort((a, b) => {
    if (a.upstream !== b.upstream) return a.upstream ? -1 : 1;
    return a.index - b.index;
  });

  console.log(`[ethernet:${deviceId}] ${ports.length} interfaces`);
  return NextResponse.json({ ports });
}
