// Server-side module — do NOT add "use client".
// Reads the SW Release Matrix from Supabase (production) or the local XLSX file (dev fallback).


import * as fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';

export interface SwMatrix {
  beaconModels: string[];
  releases: string[];
  /** keyed by normalized build string (no leading "3", trimmed, uppercased) */
  lookup: Map<string, { releaseName: string; beaconModel: string }>;
  /** raw build string per [releaseName][beaconModel], only for non-N/A cells */
  buildsByRelease: Record<string, Record<string, string>>;
}

type ReleaseRow = { name: string; builds: Record<string, string> };

let cached: SwMatrix | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute — callers also call clearSwMatrixCache() after writes

export function clearSwMatrixCache() {
  cached = null;
  cachedAt = 0;
}

function normalizeBuild(raw: string): string {
  let s = raw.trim().toUpperCase();
  if (s.startsWith('3')) s = s.slice(1);
  return s;
}

function assembleMatrix(beaconModels: string[], releaseRows: ReleaseRow[]): SwMatrix {
  const releases: string[] = [];
  const lookup = new Map<string, { releaseName: string; beaconModel: string }>();
  const buildsByRelease: Record<string, Record<string, string>> = {};

  for (const row of releaseRows) {
    releases.push(row.name);
    for (const [model, build] of Object.entries(row.builds)) {
      if (!build || build.toUpperCase() === 'N/A') continue;
      const key = normalizeBuild(build);
      if (key) {
        lookup.set(key, { releaseName: row.name, beaconModel: model });
        if (!buildsByRelease[row.name]) buildsByRelease[row.name] = {};
        buildsByRelease[row.name][model] = build;
      }
    }
  }

  return { beaconModels, releases, lookup, buildsByRelease };
}

function readFromXlsx(): SwMatrix {
  const filePath = path.join(process.cwd(), 'docs', 'SW Release Matrix.xlsx');

  try {
    const mtime = fs.statSync(filePath).mtimeMs;
    if (cached && cachedAt === mtime) return cached;
    cachedAt = mtime;
  } catch {
    cached = null;
    cachedAt = 0;
  }

  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const wsRef = ws['!ref'] as string | undefined;
  const fullRange = wsRef ? XLSX.utils.decode_range(wsRef) : XLSX.utils.decode_range('B1:N38');
  const range = { s: { r: 0, c: 1 }, e: fullRange.e };

  const beaconModels: string[] = [];
  for (let ci = range.s.c + 1; ci <= range.e.c; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: ci })];
    if (cell?.v != null) beaconModels.push(String(cell.v).trim());
  }

  const releaseRows: ReleaseRow[] = [];
  for (let ri = range.s.r + 1; ri <= range.e.r; ri++) {
    const releaseCell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c })];
    if (!releaseCell?.v) continue;
    const releaseName = String(releaseCell.v).trim();
    const builds: Record<string, string> = {};
    for (let mi = 0; mi < beaconModels.length; mi++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c + 1 + mi })];
      if (!cell?.v) continue;
      const raw = String(cell.v).trim();
      if (raw && raw.toUpperCase() !== 'N/A') builds[beaconModels[mi]] = raw;
    }
    releaseRows.push({ name: releaseName, builds });
  }

  const result = assembleMatrix(beaconModels, releaseRows);
  cached = result;
  return result;
}

async function readFromDatabase(): Promise<SwMatrix> {
  // Dynamic import keeps prisma out of the bundle when DATABASE_URL is absent
  const { prisma } = await import('./prisma');
  let row = await prisma.swMatrix.findUnique({ where: { id: 1 } });

  // Auto-seed from XLSX on first ever request if the table is empty
  if (!row) {
    console.log('[sw-matrix] no data in DB — seeding from XLSX');
    const seed = readFromXlsx();
    const releases: ReleaseRow[] = seed.releases.map((name) => ({
      name,
      builds: seed.buildsByRelease[name] ?? {},
    }));
    row = await prisma.swMatrix.create({
      data: { id: 1, beaconModels: JSON.parse(JSON.stringify(seed.beaconModels)), releases: JSON.parse(JSON.stringify(releases)) },
    });
    console.log(`[sw-matrix] seeded: ${seed.releases.length} releases`);
  }

  const result = assembleMatrix(
    row.beaconModels as string[],
    row.releases as ReleaseRow[],
  );
  cached = result;
  cachedAt = Date.now();
  return result;
}

export async function getSwMatrix(): Promise<SwMatrix> {
  if (cached && process.env.DATABASE_URL && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }
  if (process.env.DATABASE_URL) return readFromDatabase();
  return readFromXlsx();
}

export function matchFirmware(
  fw: string,
  matrix: SwMatrix,
): { releaseName: string; beaconModel: string } | null {
  if (!fw) return null;
  const key = normalizeBuild(fw);
  return matrix.lookup.get(key) ?? null;
}

/** Extracts a BBDR release hint from "1.2403.395" → "BBDR2403" */
export function deriveRelease(formattedVersion: string): string | null {
  if (!formattedVersion) return null;
  const match = formattedVersion.match(/^\d+\.(\d{4})\.\d+/);
  if (!match) return null;
  return `BBDR${match[1]}`;
}
