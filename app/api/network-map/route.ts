import { NextRequest, NextResponse } from 'next/server';
import { getReportCache, type ReportDevice } from '@/web/lib/corteca/reportCache';
import { clearNameCache } from '@/web/lib/corteca/nameCache';
import { ensureDeploymentReport, REPORT_MAX_AGE_MS } from '@/web/lib/corteca/deploymentReport';

export type { ReportDevice };

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('corteca_token')?.value;
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const baseUrl = process.env.CORTECA_API_BASE_URL;
    if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

    const force = req.nextUrl.searchParams.get('force') === 'true';

    const existing = getReportCache();
    const ageMs = existing ? Date.now() - existing.cachedAt : Infinity;
    const isStale = ageMs > REPORT_MAX_AGE_MS;

    // Serve from cache when fresh and not forced
    if (!force && !isStale && existing) {
      console.log(`[network-map] cache fresh (age: ${Math.round(ageMs / 60_000)}m)`);
      return NextResponse.json({ ...existing, fromCache: true });
    }

    if (force) clearNameCache();

    const authHeaders: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const result = await ensureDeploymentReport(baseUrl, authHeaders, { force });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

    const cache = getReportCache()!;
    return NextResponse.json({ ...cache, fromCache: false });
  } catch (e) {
    console.error('[network-map] unhandled error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
