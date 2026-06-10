import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

export interface AlarmEntry {
  ap?: string;
  entity?: string;
  category?: string;
  severity?: string;
  message?: string;
  createdTime?: number;
  updatedTime?: number;
  tenantId?: string;
  sn?: string;
  customerId?: string;
  model?: string;
  [key: string]: unknown;
}

export interface AlarmsResponse {
  alarms: AlarmEntry[];
  total: number;
  date_start: string;
  date_end: string;
  severities: string;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('corteca_token')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const baseUrl = process.env.CORTECA_API_BASE_URL;
    if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

    const sp = req.nextUrl.searchParams;
    const date_start = sp.get('date_start');
    const date_end   = sp.get('date_end');
    const severities = sp.get('severities');

    if (!date_start || !date_end || !severities) {
      return NextResponse.json(
        { error: 'date_start, date_end, and severities are required' },
        { status: 400 },
      );
    }

    // isCustomAlarm is required by the ouife endpoint — it must be explicitly set
    // (True = custom alarms, False = standard system alarms).
    const isCustomAlarm = sp.get('isCustomAlarm') ?? 'False';

    const params = new URLSearchParams({ date_start, date_end, severities, isCustomAlarm });
    const device_mac = sp.get('device_mac');
    if (device_mac) params.set('device_mac', device_mac);
    const page  = sp.get('page');
    if (page)  params.set('page', page);
    const limit = sp.get('limit');
    if (limit) params.set('limit', limit);

    const upstreamUrl = `${baseUrl}/ouife/alarms/details/ouifeapi?${params.toString()}`;
    console.log('[alarms] fetching:', upstreamUrl);

    // GET request — no body, so use Accept not Content-Type.
    // Sending Content-Type on a bodyless GET causes some API gateways to fail the
    // implicit Expect negotiation and return 417.
    const res = await cortecaFetch(
      upstreamUrl,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      30_000,
    );

    const ct = res.headers.get('content-type') ?? '';

    if (!res.ok) {
      let errorDetail: string;
      try {
        const raw = ct.includes('application/json')
          ? JSON.stringify(await res.json())
          : await res.text();
        errorDetail = raw || `HTTP ${res.status}`;
      } catch {
        errorDetail = `HTTP ${res.status}`;
      }
      console.error(`[alarms] upstream error ${res.status}:`, errorDetail);
      return NextResponse.json(
        { error: `Corteca API error (${res.status}): ${errorDetail}` },
        { status: res.status },
      );
    }

    const raw = await res.json() as unknown;

    // Normalise: ouife returns { count, alarmsDetailsList: [...] }
    let alarms: AlarmEntry[];
    if (Array.isArray(raw)) {
      alarms = raw as AlarmEntry[];
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const candidate =
        obj['alarmsDetailsList'] ??
        obj['alarms'] ??
        obj['data'] ??
        obj['results'] ??
        obj['content'];
      alarms = Array.isArray(candidate) ? (candidate as AlarmEntry[]) : [obj as AlarmEntry];
    } else {
      alarms = [];
    }

    const response: AlarmsResponse = {
      alarms,
      total: alarms.length,
      date_start,
      date_end,
      severities,
    };

    return NextResponse.json(response);
  } catch (e) {
    console.error('[alarms] unhandled error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
