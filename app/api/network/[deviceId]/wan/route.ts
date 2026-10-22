import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseGetResp } from '@/web/lib/corteca/usp';
import { parseWan, WAN_PATHS } from '@/web/lib/wanInfo';

// The gateway's Internet connection (WAN IP interface + physical WAN port) from
// its TR-181 data model; one USP GET. Returns { wan: WanInfo }.

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
    header: { msgId: 'wan', msgType: 'GET' },
    body: { request: { get: { param_paths: WAN_PATHS } } },
  });
  if (!result.ok) {
    return NextResponse.json({ error: `Gateway WAN status unavailable (HTTP ${result.status})` }, { status: 502 });
  }
  const wan = parseWan(parseGetResp((result.json as Record<string, unknown>)?.body));
  if (!wan) return NextResponse.json({ error: 'The gateway reported no WAN interface' }, { status: 404 });
  return NextResponse.json({ wan });
}
