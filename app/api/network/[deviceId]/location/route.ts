import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { extractLatLng, type LatLng } from '@/web/lib/networkLocation';

// GET: the gateway's position from its Corteca device summary (one ouife call; the REST network
// route reads the same summary). Returns { location: { lat, lng } | null }.

async function readSummary(token: string, mac: string): Promise<{ location: LatLng | null } | { error: string }> {
  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return { error: 'API not configured' };
  // Bodyless GET: no Content-Type (some ouife gateways answer 417 when it's present).
  const res = await cortecaFetch(`${baseUrl}/ouife/devices/${encodeURIComponent(mac)}/summary/ouifeapi`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  }).catch(() => null);
  if (!res) return { error: 'Corteca did not answer' };
  if (!res.ok) return { error: `Device summary unavailable (HTTP ${res.status})` };
  return { location: extractLatLng(await res.json().catch(() => null)) };
}

const gatewayMac = (id: string) => decodeURIComponent(id).toUpperCase().replace(/:/g, '-');

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const r = await readSummary(token, gatewayMac((await params).deviceId));
  return 'error' in r ? NextResponse.json(r, { status: 502 }) : NextResponse.json(r);
}
