import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

export interface DeviceMarker {
  mac: string;
  lat: number;
  lng: number;
  online: boolean;
  model: string;
  firmware: string;
  customerId: string;
  accountName: string;
  country: string;
}

// Module-level cache — survives across requests within one Next.js process.
// Null = known miss (no location data); undefined (absent key) = not yet fetched.
const coordCache  = new Map<string, { lat: number; lng: number; country: string; accountName: string } | null>();
const rateLimited = new Map<string, number>(); // mac → timestamp when 429 received

const RATE_LIMIT_BACKOFF = 300_000; // 5 min

function getCached(mac: string): { lat: number; lng: number; country: string; accountName: string } | null | undefined {
  if (rateLimited.has(mac)) {
    if (Date.now() - rateLimited.get(mac)! < RATE_LIMIT_BACKOFF) return null;
    rateLimited.delete(mac);
  }
  return coordCache.has(mac) ? (coordCache.get(mac) ?? null) : undefined;
}

function setCache(mac: string, val: { lat: number; lng: number; country: string; accountName: string } | null) {
  coordCache.set(mac, val);
}

// Extract subscriber display name from Corteca subscriber API response
function extractSubName(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const arr = Array.isArray(data) ? data : ((data as Record<string, unknown>).content ?? [data]);
  const sub = Array.isArray(arr) ? arr[0] : null;
  if (!sub || typeof sub !== 'object') return '';
  const s = sub as Record<string, unknown>;
  if (typeof s.name === 'string' && s.name.trim()) return s.name.trim();
  const fn = typeof s.first_name === 'string' ? s.first_name.trim() : '';
  const ln = typeof s.last_name  === 'string' ? s.last_name.trim()  : '';
  return [fn, ln].filter(Boolean).join(' ');
}

// Recursively search for country/countryCode field
function extractCountry(data: unknown, depth = 0): string {
  if (!data || typeof data !== 'object' || depth > 4) return '';
  if (Array.isArray(data)) {
    for (const item of data) { const r = extractCountry(item, depth + 1); if (r) return r; }
    return '';
  }
  const s = data as Record<string, unknown>;
  const direct = s.country ?? s.Country ?? s.countryCode ?? s.country_code ?? s.countryName;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  for (const val of Object.values(s)) {
    if (val && typeof val === 'object') { const r = extractCountry(val, depth + 1); if (r) return r; }
  }
  return '';
}

// Recursively search for latitude/longitude fields
function extractLatLng(data: unknown, depth = 0): { lat: number; lng: number } | null {
  if (!data || typeof data !== 'object' || depth > 4) return null;
  if (Array.isArray(data)) {
    for (const item of data) { const r = extractLatLng(item, depth + 1); if (r) return r; }
    return null;
  }
  const s = data as Record<string, unknown>;
  const n = (v: unknown) => { const x = Number(v); return isNaN(x) ? undefined : x; };
  const lat = n(s.latitude ?? s.lat ?? s.Latitude ?? s.LAT);
  const lng = n(s.longitude ?? s.lng ?? s.lon ?? s.Longitude ?? s.LNG ?? s.LON);
  if (lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0)) return { lat, lng };
  for (const val of Object.values(s)) {
    if (val && typeof val === 'object') { const r = extractLatLng(val, depth + 1); if (r) return r; }
  }
  return null;
}

// GET /api/network-map/locate?macs=MAC1,MAC2,...
export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const macs = (req.nextUrl.searchParams.get('macs') ?? '')
    .split(',').map((m) => m.trim()).filter(Boolean);

  if (macs.length === 0) return NextResponse.json([]);

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  let rateLimitHit = false;

  const results = await Promise.all(
    macs.map(async (mac): Promise<{ mac: string; lat: number; lng: number; country: string; accountName: string } | null> => {
      const cached = getCached(mac);
      if (cached !== undefined) {
        // Re-fetch if cached entry is missing an account name (stale from before POST fix)
        if (cached && cached.accountName) {
          console.log(`[locate] ${mac} → cache hit`);
          return { mac, ...cached };
        }
        if (cached === null) return null;
        // Fall through to re-fetch when cached but accountName is empty
      }

      if (rateLimitHit) return null;

      try {
        // Fetch OUIFE location and subscriber name in parallel
        const [ouifeRes, subRes] = await Promise.all([
          cortecaFetch(`${baseUrl}/ouife/devices/${mac}/summary/ouifeapi`, { headers: authHeaders }),
          cortecaFetch(`${baseUrl}/dashboard-bff/subscribers?page=0&size=1&live_status=false`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ device_id: mac }),
          }).catch(() => null),
        ]);

        const rawText = await ouifeRes.text();

        if (ouifeRes.status === 429) {
          console.warn(`[locate] ${mac} → 429 rate limited`);
          rateLimited.set(mac, Date.now());
          rateLimitHit = true;
          return null;
        }

        if (ouifeRes.status === 404) { setCache(mac, null); return null; }

        if (!ouifeRes.ok) {
          console.warn(`[locate] ${mac} → HTTP ${ouifeRes.status}: ${rawText.slice(0, 200)}`);
          setCache(mac, null);
          return null;
        }

        let data: unknown = null;
        try { data = JSON.parse(rawText); } catch { /* not JSON */ }

        const coords = extractLatLng(data);
        if (!coords) {
          console.warn(`[locate] ${mac} → no coords in: ${rawText.slice(0, 400)}`);
          setCache(mac, null);
          return null;
        }

        const country     = extractCountry(data);
        const accountName = subRes?.ok ? extractSubName(await subRes.json().catch(() => null)) : '';
        console.log(`[locate] ${mac} → ${coords.lat},${coords.lng}${accountName ? ` "${accountName}"` : ''}${country ? ` (${country})` : ''}`);

        setCache(mac, { ...coords, country, accountName });
        return { mac, lat: coords.lat, lng: coords.lng, country, accountName };
      } catch (e) {
        console.error(`[locate] ${mac} → exception: ${e}`);
        return null;
      }
    })
  );

  const headers: Record<string, string> = {};
  if (rateLimitHit) headers['X-Rate-Limited'] = 'true';

  return NextResponse.json(results.filter(Boolean), { headers });
}
