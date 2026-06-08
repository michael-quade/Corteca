import { NextRequest, NextResponse } from 'next/server';
import type { SessionRecord } from '@/web/lib/sessionHistory';

export async function GET() {
  if (!process.env.DATABASE_URL) return NextResponse.json([]);
  try {
    const { prisma } = await import('../../../web/lib/prisma');
    const rows = await prisma.apiSession.findMany({
      orderBy: { startTime: 'desc' },
      take: 500,
    });
    const sessions: SessionRecord[] = rows.map((r) => ({
      id: r.id,
      startTime: r.startTime.getTime(),
      endTime: r.endTime?.getTime() ?? null,
      calls: r.calls,
      bytesSent: r.bytesSent,
      bytesReceived: r.bytesReceived,
      rateLimitHits: r.rateLimitHits,
    }));
    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PUT(req: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ ok: true });
  try {
    const { prisma } = await import('../../../web/lib/prisma');
    const s = await req.json() as SessionRecord;
    await prisma.apiSession.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        startTime: new Date(s.startTime),
        endTime: s.endTime != null ? new Date(s.endTime) : null,
        calls: s.calls,
        bytesSent: s.bytesSent,
        bytesReceived: s.bytesReceived,
        rateLimitHits: s.rateLimitHits,
      },
      update: {
        endTime: s.endTime != null ? new Date(s.endTime) : null,
        calls: s.calls,
        bytesSent: s.bytesSent,
        bytesReceived: s.bytesReceived,
        rateLimitHits: s.rateLimitHits,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 },
    );
  }
}
