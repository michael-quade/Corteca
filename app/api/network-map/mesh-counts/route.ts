import { NextRequest, NextResponse } from 'next/server';
import { cortecaFetch } from '@/web/lib/corteca/cortecaFetch';
import { parseMeshCount, MESH_BATCH, type MeshCount } from '@/web/lib/meshCounts';

/** Per-network answers shared by every user of this instance for a few minutes. */
const TTL_MS = 10 * 60_000;
const store = ((globalThis as { __meshCounts?: Map<string, { at: number; value: MeshCount | null }> }).__meshCounts ??= new Map());

const ID = /^[0-9A-F]{2}(-[0-9A-F]{2}){5}$/;
/** Reads in flight per request: a worker pool, so one slow mesh doesn't hold up the rest. */
const WORKERS = 10;

type Answer = MeshCount | null | { error: string };

async function readMesh(baseUrl: string, token: string, id: string): Promise<Answer> {
  const hit = store.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    // GET without Content-Type (some Corteca gateways answer 417 to a bodyless GET with one).
    const res = await cortecaFetch(`${baseUrl}/homehub/networks/${id}/mesh`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, 8_000);
    if (res.status === 401) return { error: 'unauthorized' };
    if (res.status === 404) { store.set(id, { at: Date.now(), value: null }); return null; }
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const value = parseMeshCount(await res.json());
    store.set(id, { at: Date.now(), value });
    return value;
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'failed' };
  }
}

/**
 * POST { ids: Home WiFi IDs (≤ MESH_BATCH) } → { meshes: { [id]: MeshCount | null | { error } } }.
 * null = Corteca has no mesh for that network. Read-only.
 */
export async function POST(req: NextRequest) {
  const token = req.cookies.get('corteca_token')?.value;
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const baseUrl = process.env.CORTECA_API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ error: 'API not configured' }, { status: 503 });

  const body = await req.json().catch(() => null) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string').map((x) => x.trim().toUpperCase()))].filter((x) => ID.test(x))
    : [];
  if (!ids.length || ids.length > MESH_BATCH) {
    return NextResponse.json({ error: `Send 1–${MESH_BATCH} Home WiFi IDs` }, { status: 400 });
  }

  const meshes: Record<string, Answer> = {};
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      meshes[id] = await readMesh(baseUrl, token, id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, ids.length) }, worker));
  if (Object.values(meshes).some((a) => a && 'error' in a && a.error === 'unauthorized')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ meshes });
}
