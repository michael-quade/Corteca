import { NextRequest, NextResponse } from 'next/server';
import { regionOf } from '@/web/lib/geoRegions';
import type { GeoRegion } from '@/web/lib/regionFilter';

const MAX_POINTS = 5000;

// POST /api/network-map/regions  { points: [{ mac, lat, lng }] }
// Returns { regions: { [mac]: GeoRegion } } — continent, country and US/Canada state or province,
// worked out offline from the coordinates (no Corteca call).
export async function POST(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { points?: unknown } | null;
  if (!Array.isArray(body?.points)) return NextResponse.json({ error: 'Expected { points: [...] }' }, { status: 400 });

  const regions: Record<string, GeoRegion> = {};
  for (const p of body.points.slice(0, MAX_POINTS) as { mac?: unknown; lat?: unknown; lng?: unknown }[]) {
    const lat = Number(p?.lat), lng = Number(p?.lng);
    if (typeof p?.mac !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    regions[p.mac] = regionOf(lat, lng);
  }
  return NextResponse.json({ regions });
}
