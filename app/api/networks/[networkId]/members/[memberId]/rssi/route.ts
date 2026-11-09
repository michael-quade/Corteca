import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { ROAMING_DAYS } from '@/web/lib/roamingHistory';

/**
 * One client's association / RSSI history (dashboard-bff): ASSOCIATED, DISASSOCIATED,
 * RSSI_CHANGED and DEV_SWITCH_OFF events with the AP, band, channel and signal.
 * Corteca's default window is 7 days; we ask for ROAMING_DAYS unless `from`/`to` are given.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ networkId: string; memberId: string }> }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const { networkId, memberId } = await params;
  const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
  const to = req.nextUrl.searchParams.get('to') ?? iso(new Date());
  const from = req.nextUrl.searchParams.get('from') ?? iso(new Date(Date.parse(to) - ROAMING_DAYS * 86_400_000));
  const qs = new URLSearchParams({ from, to });
  const url = `${baseUrl}/dashboard-bff/networks/${encodeURIComponent(networkId)}/members/${encodeURIComponent(memberId)}/rssi?${qs}`;

  let cortecaRes: Response;
  try {
    cortecaRes = await cortecaFetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
  }

  if (!cortecaRes.ok) {
    const body = await cortecaRes.text();
    console.error('[corteca rssi] error:', cortecaRes.status, body);
    return NextResponse.json(
      { error: `Corteca error (${cortecaRes.status}): ${body}` },
      { status: cortecaRes.status }
    );
  }

  return NextResponse.json(await cortecaRes.json());
}
