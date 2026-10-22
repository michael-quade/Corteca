import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import type { Subscriber } from '@/web/lib/corteca/types';
import {
  isSearchField,
  mergeSubscribers,
  SearchInputError,
  upstreamQueries,
  type SearchField,
  type UpstreamQuery,
} from '@/web/lib/subscriberSearch';

const PAGE_SIZE = 20;

type QueryResult = { ok: true; list: Subscriber[]; full: boolean } | { ok: false; status: number; error: string };

async function runQuery(baseUrl: string, token: string, q: UpstreamQuery): Promise<QueryResult> {
  const params = new URLSearchParams({ [q.param]: q.value, size: String(PAGE_SIZE) });
  const url = `${baseUrl}/dashboard-bff/subscribers?${params}`;
  console.log('[corteca subscribers] GET', url);
  let res: Response;
  try {
    res = await cortecaFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  } catch {
    return { ok: false, status: 502, error: 'Could not reach the Corteca API.' };
  }
  if (!res.ok) {
    const body = await res.text();
    console.error('[corteca subscribers] error:', res.status, body);
    return { ok: false, status: res.status, error: `Corteca error (${res.status}): ${body}` };
  }
  const data = await res.json();
  const list: Subscriber[] = Array.isArray(data) ? data : (data.content ?? []);
  return { ok: true, list: q.keep ? list.filter(q.keep) : list, full: list.length >= PAGE_SIZE };
}

/**
 * Subscriber search. `?q=…&field=auto|name|email|customerId|mac|serial`
 * (`?name=…` still works). Returns `{ results, fields, truncated }`: the fields
 * searched, and whether Corteca may have more (a query returned a full page).
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const legacyName = searchParams.get('name');
  const q = (searchParams.get('q') ?? legacyName ?? '').trim();
  if (!q) {
    return NextResponse.json({ error: 'q query param is required' }, { status: 400 });
  }
  const rawField = searchParams.get('field');
  const field: SearchField = isSearchField(rawField) ? rawField : legacyName !== null ? 'name' : 'auto';

  let queries: UpstreamQuery[];
  try {
    queries = upstreamQueries(q, field);
  } catch (e) {
    if (e instanceof SearchInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const results = await Promise.all(queries.map((uq) => runQuery(baseUrl, token, uq)));
  const ok = results.filter((r): r is Extract<QueryResult, { ok: true }> => r.ok);
  if (ok.length === 0) {
    // 401 first, so an expired session opens the re-login dialog.
    const failed = results as Extract<QueryResult, { ok: false }>[];
    const first = failed.find((r) => r.status === 401) ?? failed[0];
    return NextResponse.json({ error: first.error }, { status: first.status });
  }

  return NextResponse.json({
    results: mergeSubscribers(ok.map((r) => r.list)),
    fields: [...new Set(queries.map((uq) => uq.field))],
    truncated: ok.some((r) => r.full),
  });
}
