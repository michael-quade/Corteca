import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { getNameCache } from '@/web/lib/corteca/nameCache';

function extractName(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).content;
  const sub = Array.isArray(arr) ? arr[0] : null;
  if (!sub || typeof sub !== 'object') return '';
  const s = sub as Record<string, unknown>;
  if (typeof s.name === 'string' && s.name.trim()) return s.name.trim();
  const fn = typeof s.first_name === 'string' ? s.first_name.trim() : '';
  const ln = typeof s.last_name  === 'string' ? s.last_name.trim()  : '';
  return [fn, ln].filter(Boolean).join(' ');
}

// GET /api/network-map/account-names?macs=MAC1,MAC2
//   or ?ids=ID1,ID2&lookupField=serial_no
// Returns [{ mac: string; accountName: string }]  (mac = input id, for client keying)
export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  // Accept either ?macs= (legacy) or ?ids= (generic)
  const rawIds = req.nextUrl.searchParams.get('ids') ?? req.nextUrl.searchParams.get('macs') ?? '';
  const ids = rawIds.split(',').map((m) => m.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json([]);

  // Which subscriber search field to use in the POST body (default: device_id for MAC lookup)
  const lookupField = req.nextUrl.searchParams.get('lookupField') ?? 'device_id';

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const nameCache = getNameCache();

  async function fetchOne(id: string): Promise<{ mac: string; accountName: string }> {
    const cacheKey = `${lookupField}:${id}`;
    if (nameCache.has(cacheKey)) return { mac: id, accountName: nameCache.get(cacheKey)! };

    try {
      const res = await cortecaFetch(
        `${baseUrl}/dashboard-bff/subscribers?page=0&size=1&live_status=false`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ [lookupField]: id }),
        }
      );

      if (!res.ok) {
        console.warn(`[account-names] ${lookupField}=${id} → HTTP ${res.status}`);
        return { mac: id, accountName: '' };
      }

      const data = await res.json().catch(() => null);
      const name = extractName(data);
      if (name) {
        nameCache.set(cacheKey, name);
        console.log(`[account-names] ${lookupField}=${id} → "${name}"`);
      }
      return { mac: id, accountName: name };
    } catch (e) {
      const isTimeout = e instanceof Error && (
        e.name === 'TimeoutError' || e.name === 'AbortError' ||
        (e as NodeJS.ErrnoException).code === 'UND_ERR_CONNECT_TIMEOUT'
      );
      if (isTimeout) {
        console.warn(`[account-names] ${lookupField}=${id} → connect timeout, skipping`);
      } else {
        console.warn(`[account-names] ${lookupField}=${id} exception:`, e);
      }
      return { mac: id, accountName: '' };
    }
  }

  // Process in chunks of 3 to avoid overwhelming the upstream connection pool
  const CONCURRENCY = 3;
  const results: { mac: string; accountName: string }[] = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(fetchOne));
    results.push(...chunkResults);
  }

  return NextResponse.json(results);
}
