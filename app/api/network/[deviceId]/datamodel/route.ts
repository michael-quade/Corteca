import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost, parseSupportedDmResp, parseGetResp } from '@/web/lib/corteca/usp';

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

  const path           = req.nextUrl.searchParams.get('path') ?? 'Device.';
  const firstLevelOnly = req.nextUrl.searchParams.get('firstLevelOnly') !== 'false';
  const withValues     = req.nextUrl.searchParams.get('values') === 'true';

  const endpointId = await resolveUspEndpointId(deviceId, baseUrl, authHeaders);
  console.log(`[datamodel:${deviceId}] EID=${endpointId} path=${path} firstLevelOnly=${firstLevelOnly}`);

  const schemaResult = await uspPost(baseUrl, endpointId, deviceId, authHeaders, {
    header: { msgId: 'dm-schema', msgType: 'GET_SUPPORTED_DM' },
    body: {
      request: {
        getSupportedDm: {
          objPaths: [path],
          firstLevelOnly,
          returnCommands: true,
          returnEvents:   true,
          returnParams:   true,
        },
      },
    },
  });

  const schema = parseSupportedDmResp((schemaResult.json as Record<string, unknown>)?.body);

  if (!schemaResult.ok && schema.length === 0) {
    return NextResponse.json(
      { error: `USP GET_SUPPORTED_DM failed (HTTP ${schemaResult.status})` },
      { status: 502 },
    );
  }

  let values: Record<string, string> | null = null;
  if (withValues) {
    const valResult = await uspPost(baseUrl, endpointId, deviceId, authHeaders, {
      header: { msgId: 'dm-values', msgType: 'GET' },
      body: { request: { get: { param_paths: [path] } } },
    });
    values = parseGetResp((valResult.json as Record<string, unknown>)?.body);
  }

  console.log(`[datamodel:${deviceId}] ${schema.length} objects returned`);
  return NextResponse.json({ schema, values, endpointId });
}
