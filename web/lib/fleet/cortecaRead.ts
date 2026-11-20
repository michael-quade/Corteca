/** Server: read-only Corteca GETs for Fleet Metrics (no Content-Type on GETs — ouife answers 417). */
import { cortecaFetch } from "@/web/lib/corteca/cortecaFetch";

export class CortecaReadError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

export async function cortecaGet(base: string, token: string, path: string, opts: { csv?: boolean; timeoutMs?: number } = {}): Promise<string> {
  const res = await cortecaFetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: opts.csv ? "text/csv, */*" : "application/json" },
  }, opts.timeoutMs ?? 30_000);
  const text = await res.text();
  if (!res.ok) throw new CortecaReadError(`Corteca answered ${res.status} for ${path.split("?")[0]}`, res.status);
  return text;
}

export async function cortecaJson<T = unknown>(base: string, token: string, path: string, timeoutMs?: number): Promise<T> {
  return JSON.parse(await cortecaGet(base, token, path, { timeoutMs })) as T;
}

/** ouife wants `yyyy-MM-ddTHH:mm:ss` in UTC. */
export function ouifeTime(d: Date): string {
  return d.toISOString().slice(0, 19);
}

/** Runs `fn` over items, `limit` at a time, until done or `deadline` (ms epoch) passes. Returns the results it got. */
export async function mapLimited<T, R>(items: T[], limit: number, deadline: number, fn: (t: T) => Promise<R>): Promise<{ item: T; result?: R; error?: string }[]> {
  const out: { item: T; result?: R; error?: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length && Date.now() < deadline) {
      const item = items[i++];
      try { out.push({ item, result: await fn(item) }); } catch (e) { out.push({ item, error: e instanceof Error ? e.message : String(e) }); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Reads every page of a paged list (`page`, `size`) until a short page — or a page that repeats the first one (some endpoints ignore paging). */
export async function readAllPages<T>(base: string, token: string, path: string, size = 200, maxPages = 25): Promise<{ items: T[]; capped: boolean }> {
  const items: T[] = [];
  let firstKey = "";
  for (let page = 0; page < maxPages; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await cortecaJson<T[]>(base, token, `${path}${sep}page=${page}&size=${size}`);
    if (!Array.isArray(batch) || !batch.length) return { items, capped: false };
    const key = JSON.stringify(batch[0]);
    if (page > 0 && key === firstKey) return { items, capped: false };
    if (page === 0) firstKey = key;
    items.push(...batch);
    if (batch.length < size) return { items, capped: false };
  }
  return { items, capped: true };
}
