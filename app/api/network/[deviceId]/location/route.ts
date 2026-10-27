import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { extractLatLng } from '@/web/lib/networkLocation';

// The gateway's position from its Corteca device summary (one ouife call; the REST
// network route reads the same summary). Returns { location: { lat, lng } | null }.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { deviceId } = await params;
  const mac = decodeURIComponent(deviceId).toUpperCase().replace(/:/g, '-');
  // Bodyless GET: no Content-Type (some ouife gateways answer 417 when it's present).
  const res = await cortecaFetch(`${baseUrl}/ouife/devices/${encodeURIComponent(mac)}/summary/ouifeapi`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Corteca did not answer' }, { status: 502 });
  if (!res.ok) return NextResponse.json({ error: `Device summary unavailable (HTTP ${res.status})` }, { status: 502 });
  const summary = await res.json().catch(() => null);
  return NextResponse.json({ location: extractLatLng(summary) });
}
