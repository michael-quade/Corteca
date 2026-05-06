import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';

// ─── CSV parser ───────────────────────────────────────────────────────────────

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

// ─── Report metadata type ─────────────────────────────────────────────────────

interface ReportMeta {
  type: string;
  date_range: { start_date: string; end_date: string };
  href: string;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // ── Step 1: list all available reports ──────────────────────────────────────
  const listUrl = `${baseUrl}/measures/reports?page=0&size=210&shard_id=1`;
  console.log('[reboot-report] listing reports:', listUrl);

  let listRes: Response;
  try {
    listRes = await cortecaFetch(listUrl, { headers: authHeaders });
  } catch {
    return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
  }

  if (!listRes.ok) {
    const body = await listRes.text();
    console.error('[reboot-report] list error:', listRes.status, body);
    return NextResponse.json(
      { error: `Corteca error listing reports (${listRes.status}): ${body}` },
      { status: listRes.status >= 500 ? 502 : listRes.status }
    );
  }

  const reports: ReportMeta[] = await listRes.json();
  console.log('[reboot-report] total reports returned:', reports.length);

  // ── Step 2: find the latest "reboot" report ─────────────────────────────────
  const rebootReports = reports
    .filter((r) => r.type === 'reboot')
    .sort((a, b) =>
      new Date(b.date_range.end_date).getTime() -
      new Date(a.date_range.end_date).getTime()
    );

  if (rebootReports.length === 0) {
    return NextResponse.json(
      { error: 'No reboot reports found. The Corteca instance may not have generated one yet.' },
      { status: 404 }
    );
  }

  const latest = rebootReports[0];
  console.log('[reboot-report] latest reboot report:', latest);

  // ── Step 3: extract report_id from href ─────────────────────────────────────
  // href format: "/reports/{report_id}/download"
  const idMatch = latest.href.match(/\/reports\/([^/]+)\/download/);
  if (!idMatch) {
    return NextResponse.json(
      { error: `Could not parse report_id from href: ${latest.href}` },
      { status: 500 }
    );
  }
  const reportId = idMatch[1];

  // ── Step 4: download the CSV ─────────────────────────────────────────────────
  const downloadUrl = `${baseUrl}/measures/reports/${reportId}/download?shard_id=1`;
  console.log('[reboot-report] downloading CSV:', downloadUrl);

  let dlRes: Response;
  try {
    dlRes = await cortecaFetch(downloadUrl, {
      headers: { ...authHeaders, Accept: 'text/csv' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
  }

  if (!dlRes.ok) {
    const body = await dlRes.text();
    console.error('[reboot-report] download error:', dlRes.status, body);
    return NextResponse.json(
      { error: `Corteca error downloading report (${dlRes.status}): ${body}` },
      { status: dlRes.status >= 500 ? 502 : dlRes.status }
    );
  }

  const csv = await dlRes.text();
  console.log('[reboot-report] CSV head:', csv.slice(0, 300));

  const rows = parseCsv(csv);
  console.log('[reboot-report] parsed rows:', rows.length, '| columns:', rows[0] ? Object.keys(rows[0]) : []);

  return NextResponse.json(rows);
}
