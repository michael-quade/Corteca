import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { EVENT_DAYS, parseEvents, type NetworkEvent } from '@/web/lib/networkEvents';
import { markSsidResets } from '@/web/lib/ssidReset';

// Corteca returns at most 500 rows per page (pages start at 0); a busy network fills
// that in under a week, so we page until a short page or MAX_PAGES.
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

/**
 * A network's activity log (activity-log `activity_traces`): reboots, outages, backhaul
 * and channel changes, new clients, operator changes, console sessions. Last `days`
 * (≤ EVENT_DAYS). Event data is sanitised here (request payloads and anything that
 * looks like a password or key are dropped) so it never reaches the browser.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ networkId: string }> }) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { networkId } = await params;
  const days = Math.min(EVENT_DAYS, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || EVENT_DAYS));
  const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
  const to = iso(new Date());
  const from = iso(new Date(Date.now() - days * 86_400_000));

  const rows: unknown[] = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ from, to, size: String(PAGE_SIZE), page: String(page) });
    const url = `${baseUrl}/activity-log/networks/${encodeURIComponent(networkId)}/activity_traces/?${qs}`;
    let res: Response;
    try {
      res = await cortecaFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, 30_000);
    } catch {
      if (page === 0) return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
      truncated = true;
      break;
    }
    if (!res.ok) {
      const body = await res.text();
      console.error('[corteca activity] error:', res.status, body);
      if (page === 0) return NextResponse.json({ error: `Corteca error (${res.status}): ${body}` }, { status: res.status });
      truncated = true;
      break;
    }
    const json: unknown = await res.json();
    const list = Array.isArray(json) ? json : [];
    rows.push(...list);
    if (list.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  // WiFi password changes flagged (value never sent), then sanitised, de-duplicated across pages, newest first.
  const events: NetworkEvent[] = parseEvents(markSsidResets(rows));
  return NextResponse.json({ events, from, to, truncated });
}
