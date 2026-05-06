import { NextRequest, NextResponse } from 'next/server';
import { resolveUspEndpointId, uspPost } from '@/web/lib/corteca/usp';

export async function POST(
  req: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { deviceId } = params;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const body = await req.json().catch(() => null);
  const { objPath, param, value } = (body ?? {}) as Record<string, string>;
  if (!objPath || !param || value === undefined) {
    return NextResponse.json({ error: 'objPath, param, and value are required' }, { status: 400 });
  }

  const endpointId = await resolveUspEndpointId(deviceId, baseUrl, authHeaders);

  const result = await uspPost(baseUrl, endpointId, deviceId, authHeaders, {
    header: { msgId: String(Date.now()), msgType: 'SET' },
    body: {
      request: {
        set: {
          allowPartial: true,
          updateObjs: [{
            objPath,
            paramSettings: [{ param, value, required: true }],
          }],
        },
      },
    },
  });

  if (!result.ok) {
    const errMsg = (result.json as Record<string, unknown>)?.message ?? `HTTP ${result.status}`;
    console.warn(`[datamodel:set] ${objPath}${param}=${value} failed: ${errMsg}`);
    return NextResponse.json({ error: String(errMsg) }, { status: 502 });
  }

  console.log(`[datamodel:set] ${objPath}${param} = ${value} ✓`);
  return NextResponse.json({ success: true });
}
