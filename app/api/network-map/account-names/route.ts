import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { getNameCache } from '@/web/lib/corteca/nameCache';

function extractName(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const arr = Array.isArray(data) ? data : [];
  const sub = arr[0];
  if (!sub || typeof sub !== 'object') return '';
  const s = sub as Record<string, unknown>;
  if (typeof s.name === 'string' && s.name.trim()) return s.name.trim();
  const fn = typeof s.first_name === 'string' ? s.first_name.trim() : '';
  const ln = typeof s.last_name  === 'string' ? s.last_name.trim()  : '';
  return [fn, ln].filter(Boolean).join(' ');
}

// GET /api/network-map/account-names?macs=MAC1,MAC2,...
// POSTs to Corteca subscriber search with device_id for each MAC.
export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const macs = (req.nextUrl.searchParams.get('macs') ?? '')
    .split(',').map((m) => m.trim()).filter(Boolean);

  if (macs.length === 0) return NextResponse.json([]);

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const nameCache = getNameCache();

  const results = await Promise.all(
    macs.map(async (mac): Promise<{ mac: string; accountName: string }> => {
      if (nameCache.has(mac)) return { mac, accountName: nameCache.get(mac)! };

      try {
        const res = await cortecaFetch(
          `${baseUrl}/dashboard-bff/subscribers?page=0&size=1&live_status=false`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ device_id: mac }),
          }
        );

        if (!res.ok) {
          console.warn(`[account-names] ${mac} → HTTP ${res.status}`);
          return { mac, accountName: '' };
        }

        const data = await res.json().catch(() => null);
        const name = extractName(data);
        if (name) {
          nameCache.set(mac, name);
          console.log(`[account-names] ${mac} → "${name}"`);
        }
        return { mac, accountName: name };
      } catch (e) {
        console.error(`[account-names] ${mac} exception: ${e}`);
        return { mac, accountName: '' };
      }
    })
  );

  return NextResponse.json(results);
}
