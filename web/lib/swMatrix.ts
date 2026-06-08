// Server-side module — do NOT add "use client".
// Parses the SW Release Matrix XLSX and provides firmware-to-release lookup.

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

let cached: SwMatrix | null = null;

export function clearSwMatrixCache() { cached = null; }

function normalizeBuild(raw: string): string {
  let s = raw.trim().toUpperCase();
  if (s.startsWith('3')) s = s.slice(1);
  return s;
}

export function getSwMatrix(): SwMatrix {
  if (cached) return cached;

  const filePath = path.join(process.cwd(), 'docs', 'SW Release Matrix.xlsx');
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Use the worksheet's actual used range so added rows/columns are always picked up.
  // Data is anchored at B1: col B = release names, row 1 = beacon model headers.
  const wsRef = ws['!ref'] as string | undefined;
  const fullRange = wsRef ? XLSX.utils.decode_range(wsRef) : XLSX.utils.decode_range('B1:N38');
  const range = { s: { r: 0, c: 1 }, e: fullRange.e }; // force start at B1

  // Row 1 (index 0): beacon model headers in columns C onwards
  const beaconModels: string[] = [];
  for (let ci = range.s.c + 1; ci <= range.e.c; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: ci })];
    if (cell?.v != null) beaconModels.push(String(cell.v).trim());
  }

  const releases: string[] = [];
  const lookup = new Map<string, { releaseName: string; beaconModel: string }>();
  const buildsByRelease: Record<string, Record<string, string>> = {};

  // Rows 2+ (index 1+): release name in col B, build strings in cols C onwards
  for (let ri = range.s.r + 1; ri <= range.e.r; ri++) {
    const releaseCell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c })];
    if (!releaseCell?.v) continue;
    const releaseName = String(releaseCell.v).trim();
    releases.push(releaseName);

    for (let mi = 0; mi < beaconModels.length; mi++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c + 1 + mi })];
      if (!cell?.v) continue;
      const raw = String(cell.v).trim();
      if (!raw || raw.toUpperCase() === 'N/A') continue;
      const key = normalizeBuild(raw);
      if (key) {
        lookup.set(key, { releaseName, beaconModel: beaconModels[mi] });
        if (!buildsByRelease[releaseName]) buildsByRelease[releaseName] = {};
        buildsByRelease[releaseName][beaconModels[mi]] = raw;
      }
    }
  }

  cached = { beaconModels, releases, lookup, buildsByRelease };
  return cached;
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
  // Format: <major>.<YYMM>.<build>
  const match = formattedVersion.match(/^\d+\.(\d{4})\.\d+/);
  if (!match) return null;
  const yymm = match[1]; // e.g. "2403"
  return `BBDR${yymm}`;
}
