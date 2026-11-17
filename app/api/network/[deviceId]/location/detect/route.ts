import { NextRequest, NextResponse } from 'next/server';
import { detectLocation, findPortalAp } from '@/web/lib/corteca/networkPortal';

// The console's "Autodetect location" lookup for a gateway (network portal, read-only: nothing is
// stored, here or in Corteca). Returns { detected: { lat, lng, accuracy } | null, stored, zoneTag }.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { deviceId } = await params;
  try {
    const ap = await findPortalAp(token, decodeURIComponent(deviceId));
    if (!ap) return NextResponse.json({ error: 'Corteca has no WiFi point record for this gateway' }, { status: 404 });
    const detected = await detectLocation(token, ap);
    return NextResponse.json({
      detected,
      stored: ap.loc ? { lat: ap.loc.latitude, lng: ap.loc.longitude, accuracy: ap.loc.accuracy ?? null, locType: ap.loc.locType ?? null } : null,
      zoneTag: ap.zoneTag,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Location detection failed' }, { status: 502 });
  }
}
