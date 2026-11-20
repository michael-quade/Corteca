/**
 * Server: Fleet Metrics rollups — FleetRollup table + an in-memory copy (shared via globalThis).
 * If the table doesn't exist yet or the DB is unreachable, rollups live in memory only (per
 * server instance) and the DB is retried after a minute.
 */
import type { Prisma } from "@prisma/client";

export interface StoredBucket<T> { bucket: string; data: T; complete: boolean }

type Mem = Map<string, Map<string, StoredBucket<unknown>>>;
const g = globalThis as unknown as { __fleetRollups?: Mem; __fleetRollupDbDownUntil?: number };
const mem: Mem = (g.__fleetRollups ??= new Map());

async function db() {
  if (!process.env.DATABASE_URL) return null;
  if ((g.__fleetRollupDbDownUntil ?? 0) > Date.now()) return null;
  return (await import("@/web/lib/prisma")).prisma;
}

function dbFailed(e: unknown, what: string) {
  g.__fleetRollupDbDownUntil = Date.now() + 60_000;
  console.warn(`[fleet-rollups] ${what} failed:`, e instanceof Error ? e.message.split("\n")[0] : e);
}

function memFor(source: string) {
  let m = mem.get(source);
  if (!m) { m = new Map(); mem.set(source, m); }
  return m;
}

/** Stored buckets of `source` with from ≤ bucket ≤ to, keyed by ISO bucket start. */
export async function readBuckets<T>(source: string, from: Date, to: Date): Promise<Map<string, StoredBucket<T>>> {
  const out = new Map<string, StoredBucket<T>>();
  for (const [k, v] of memFor(source)) {
    const t = Date.parse(k);
    if (t >= from.getTime() && t <= to.getTime()) out.set(k, v as StoredBucket<T>);
  }
  const client = await db();
  if (client) {
    try {
      const rows = await client.fleetRollup.findMany({ where: { source, bucket: { gte: from, lte: to } } });
      for (const r of rows) {
        const key = r.bucket.toISOString();
        const b: StoredBucket<T> = { bucket: key, data: r.data as T, complete: r.complete };
        if (!out.get(key)?.complete) out.set(key, b);
        memFor(source).set(key, b);
      }
    } catch (e) { dbFailed(e, "read"); }
  }
  return out;
}

/** Saves buckets (memory always, DB when available). */
export async function writeBuckets<T>(source: string, buckets: StoredBucket<T>[]): Promise<void> {
  if (!buckets.length) return;
  for (const b of buckets) memFor(source).set(b.bucket, b);
  const client = await db();
  if (!client) return;
  try {
    await client.$transaction(buckets.map((b) => client.fleetRollup.upsert({
      where: { source_bucket: { source, bucket: new Date(b.bucket) } },
      create: { source, bucket: new Date(b.bucket), data: b.data as Prisma.InputJsonValue, complete: b.complete },
      update: { data: b.data as Prisma.InputJsonValue, complete: b.complete },
    })));
  } catch (e) { dbFailed(e, "write"); }
}
