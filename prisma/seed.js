// One-time seed: reads the SW Release Matrix XLSX and writes it to the database.
// Run after setting DATABASE_URL and DIRECT_URL in your environment:
//   npm run seed-matrix

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parsXlsx() {
  const filePath = path.join(process.cwd(), 'docs', 'SW Release Matrix.xlsx');
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const wsRef = ws['!ref'];
  const fullRange = wsRef ? XLSX.utils.decode_range(wsRef) : XLSX.utils.decode_range('B1:N38');
  const range = { s: { r: 0, c: 1 }, e: fullRange.e };

  const beaconModels = [];
  for (let ci = range.s.c + 1; ci <= range.e.c; ci++) {
    const cell = ws[XLSX.utils.encode_cell({ r: range.s.r, c: ci })];
    if (cell && cell.v != null) beaconModels.push(String(cell.v).trim());
  }

  const releases = [];
  for (let ri = range.s.r + 1; ri <= range.e.r; ri++) {
    const releaseCell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c })];
    if (!releaseCell || !releaseCell.v) continue;
    const name = String(releaseCell.v).trim();
    const builds = {};
    for (let mi = 0; mi < beaconModels.length; mi++) {
      const cell = ws[XLSX.utils.encode_cell({ r: ri, c: range.s.c + 1 + mi })];
      if (!cell || !cell.v) continue;
      const raw = String(cell.v).trim();
      if (raw && raw.toUpperCase() !== 'N/A') builds[beaconModels[mi]] = raw;
    }
    releases.push({ name, builds });
  }

  return { beaconModels, releases };
}

async function main() {
  console.log('Reading SW Release Matrix XLSX...');
  const { beaconModels, releases } = parsXlsx();
  console.log(`  ${beaconModels.length} beacon models, ${releases.length} releases`);

  console.log('Writing to database...');
  await prisma.swMatrix.upsert({
    where:  { id: 1 },
    create: { id: 1, beaconModels, releases },
    update: { beaconModels, releases },
  });

  console.log('Done. SW matrix seeded successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
