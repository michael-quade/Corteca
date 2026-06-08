import { NextRequest, NextResponse } from 'next/server';
import { getSwMatrix, clearSwMatrixCache } from '@/web/lib/swMatrix';

export interface SwMatrixRow {
  name: string;
  builds: Record<string, string>;
}

export interface SwMatrixData {
  beaconModels: string[];
  releases: SwMatrixRow[];
}

export async function GET() {
  try {
    const matrix = await getSwMatrix();
    const data: SwMatrixData = {
      beaconModels: matrix.beaconModels,
      releases: matrix.releases.map((name) => ({
        name,
        builds: matrix.buildsByRelease[name] ?? {},
      })),
    };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to read matrix' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as SwMatrixData;
    const { beaconModels, releases } = body;

    if (!Array.isArray(beaconModels) || !Array.isArray(releases)) {
      return NextResponse.json({ error: 'Invalid matrix data' }, { status: 400 });
    }

    if (process.env.DATABASE_URL) {
      const { prisma } = await import('../../../web/lib/prisma');
      const data = {
        beaconModels: JSON.parse(JSON.stringify(beaconModels)),
        releases:     JSON.parse(JSON.stringify(releases)),
      };
      await prisma.swMatrix.upsert({
        where:  { id: 1 },
        create: { id: 1, ...data },
        update: data,
      });
    } else {
      // Local dev only — write back to the XLSX file
      const fs   = await import('fs');
      const XLSX = await import('xlsx');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'docs', 'SW Release Matrix.xlsx');
      const wsData: string[][] = [
        ['', ...beaconModels],
        ...releases.map((r) => [r.name, ...beaconModels.map((m) => r.builds[m] ?? '')]),
      ];
      const wb     = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
      const wsName = wb.SheetNames[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wb.Sheets[wsName] = (XLSX.utils.aoa_to_sheet as any)(wsData, { origin: 'B1' });
      fs.writeFileSync(filePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    }

    clearSwMatrixCache();
    console.log(`[sw-matrix] saved: ${releases.length} releases × ${beaconModels.length} models`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[sw-matrix] save failed:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save matrix' },
      { status: 500 },
    );
  }
}
