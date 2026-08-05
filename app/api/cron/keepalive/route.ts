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

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
}
