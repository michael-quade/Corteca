import { NextRequest, NextResponse } from 'next/server';
import { REPORT_CONFIGS } from '@/web/lib/reportTypes';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0]);
  return lines
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const values = parseRow(line);
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
}

interface ReportMeta {
  type: string;
  date_range: { start_date: string; end_date: string };
  href: string;
}

function matchesType(actual: string, candidates: string[]): boolean {
  const lc = actual.toLowerCase();
  return candidates.some((c) => lc === c || lc.includes(c) || c.includes(lc));
}

export async function GET(
  req: NextRequest,
  { params }: { params: { reportType: string } }
) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const config = REPORT_CONFIGS[params.reportType];
  if (!config) {
    return NextResponse.json({ error: `Unknown report type: ${params.reportType}` }, { status: 400 });
  }

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── Step 1: list reports ──────────────────────────────────────────────────
  const listUrl = `${baseUrl}/measures/reports?page=0&size=210&shard_id=1`;
  console.log(`[report:${params.reportType}] listing:`, listUrl);

  let listRes: Response;
  try {
    listRes = await cortecaFetch(listUrl, { headers: authHeaders });
  } catch {
    return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
  }

  if (!listRes.ok) {
    const body = await listRes.text();
    console.error(`[report:${params.reportType}] list error:`, listRes.status, body);
    return NextResponse.json(
      { error: `Corteca error listing reports (${listRes.status}): ${body}` },
      { status: listRes.status >= 500 ? 502 : listRes.status }
    );
  }

  const reports: ReportMeta[] = await listRes.json();
  console.log(`[report:${params.reportType}] total reports:`, reports.length);

  // ── Step 2: find latest matching report ───────────────────────────────────
  const matches = reports
    .filter((r) => matchesType(r.type, config.cortecaTypes))
    .sort(
      (a, b) =>
        new Date(b.date_range.end_date).getTime() -
        new Date(a.date_range.end_date).getTime()
    );

  console.log(`[report:${params.reportType}] matching reports:`, matches.length, matches.map(r => r.type));

  if (matches.length === 0) {
    const available = [...new Set(reports.map((r) => r.type))].join(', ');
    return NextResponse.json(
      { error: `No "${params.reportType}" report found. Available types: ${available}` },
      { status: 404 }
    );
  }

  const latest = matches[0];
  const idMatch = latest.href.match(/\/reports\/([^/]+)\/download/);
  if (!idMatch) {
    return NextResponse.json(
      { error: `Cannot parse report_id from href: ${latest.href}` },
      { status: 500 }
    );
  }
  const reportId = idMatch[1];

  // ── Step 3: download CSV ──────────────────────────────────────────────────
  const dlUrl = `${baseUrl}/measures/reports/${reportId}/download?shard_id=1`;
  console.log(`[report:${params.reportType}] downloading:`, dlUrl);

  let dlRes: Response;
  try {
    dlRes = await cortecaFetch(dlUrl, { headers: { ...authHeaders, Accept: 'text/csv' } });
  } catch {
    return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
  }

  if (!dlRes.ok) {
    const body = await dlRes.text();
    console.error(`[report:${params.reportType}] download error:`, dlRes.status, body);
    return NextResponse.json(
      { error: `Corteca error downloading report (${dlRes.status}): ${body}` },
      { status: dlRes.status >= 500 ? 502 : dlRes.status }
    );
  }

  const csv = await dlRes.text();
  const rows = parseCsv(csv);
  const meta = { reportId, type: latest.type, start: latest.date_range.start_date, end: latest.date_range.end_date };
  console.log(`[report:${params.reportType}] rows:`, rows.length, '| meta:', meta);

  return NextResponse.json({ rows, meta });
}
