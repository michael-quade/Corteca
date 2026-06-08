import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';
import { getSwMatrix, clearSwMatrixCache } from '@/web/lib/swMatrix';

export interface SwMatrixRow {
  name: string;
  builds: Record<string, string>;
}

export interface SwMatrixData {
  beaconModels: string[];
  releases: SwMatrixRow[];
}

const FILE_PATH = path.join(process.cwd(), 'docs', 'SW Release Matrix.xlsx');

export async function GET() {
  try {
    const matrix = getSwMatrix();
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

    // Build 2-D array matching the original spreadsheet layout (origin B1)
    const wsData: string[][] = [
      ['', ...beaconModels],
      ...releases.map((r) => [r.name, ...beaconModels.map((m) => r.builds[m] ?? '')]),
    ];

    const wb = XLSX.read(fs.readFileSync(FILE_PATH), { type: 'buffer' });
    const wsName = wb.SheetNames[0];
    // origin not in AOA2SheetOpts typings; cast to bypass
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wb.Sheets[wsName] = (XLSX.utils.aoa_to_sheet as any)(wsData, { origin: 'B1' });
    XLSX.writeFile(wb, FILE_PATH);

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
