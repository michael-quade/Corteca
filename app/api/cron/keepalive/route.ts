import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/web/lib/prisma';

// Pinged on a schedule by Vercel Cron (see vercel.json) to keep the Supabase
// project from auto-pausing due to inactivity.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  await prisma.$queryRaw`SELECT 1`;

  // Supabase's free-tier pause detection only watches requests through its
  // REST API (PostgREST) or dashboard access — a direct Postgres connection
  // (the query above, via Prisma/PgBouncer) does NOT reset the inactivity
  // timer. Ping the REST API too so the project registers real activity.
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let restPing: 'ok' | 'skipped' | 'failed' = 'skipped';

  if (supabaseUrl && supabaseKey) {
    const res = await fetch(`${supabaseUrl}/rest/v1/sw_matrix?select=id&limit=1`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    restPing = res.ok ? 'ok' : 'failed';
  }

  return NextResponse.json({ ok: true, restPing, timestamp: new Date().toISOString() });
}
