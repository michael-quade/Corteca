import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { parseMemberProfile, type MemberProfile } from '@/web/lib/memberProfiles';

const PAGE_SIZE = 500;
const MAX_PAGES = 10;

/**
 * Corteca's device classification for every client the network has seen (the console's Type /
 * Manufacturer / Model / Mobility): GET /station-profiles/networks/{id}/member_profiles, paged like
 * the console does. `refresh=false` only reads; it never asks Corteca to re-classify. Read-only.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ networkId: string }> }) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const { networkId } = await params;
  const profiles: MemberProfile[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${baseUrl}/station-profiles/networks/${encodeURIComponent(networkId)}/member_profiles?refresh=false&page=${page}&size=${PAGE_SIZE}`;
    let res: Response;
    try {
      res = await cortecaFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    } catch {
      return NextResponse.json({ error: 'Could not reach the Corteca API.' }, { status: 502 });
    }
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Corteca error (${res.status}): ${body.slice(0, 300)}` }, { status: res.status });
    }
    const body = (await res.json().catch(() => null)) as unknown;
    const list = Array.isArray(body) ? body : (body as { content?: unknown } | null)?.content;
    if (!Array.isArray(list)) break;
    for (const raw of list) {
      const p = parseMemberProfile(raw);
      if (p) profiles.push(p);
    }
    if (list.length < PAGE_SIZE) break;
  }
  return NextResponse.json({ profiles });
}
