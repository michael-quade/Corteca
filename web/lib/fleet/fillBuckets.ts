/**
 * Server: fills a source's time buckets (hours of cluster alarms / events, days of a daily
 * report) — stored buckets are reused, missing or unfinished ones are read from Corteca
 * newest first, several at a time, within a time budget. Callers report `pending` so the page
 * asks again (with a progress line) and the daily cron catches up the rest.
 */
import { mapLimited } from "./cortecaRead";
import { readBuckets, writeBuckets, type StoredBucket } from "./rollupStore";

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** A bucket is finished (never re-read) once it ended this long ago — Corteca logs late. */
const SETTLE_MS = 20 * 60_000;

export interface FillResult<T> {
  buckets: StoredBucket<T>[];
  /** Buckets in the range still not read. */
  pending: number;
  total: number;
  errors: string[];
}

/** Bucket starts (ms) from `from` to `to` inclusive, step `size`, aligned to `size` (UTC). */
export function bucketStarts(from: number, to: number, size: number): number[] {
  const out: number[] = [];
  for (let t = Math.floor(from / size) * size; t <= to; t += size) out.push(t);
  return out;
}

export async function fillBuckets<T>(opts: {
  source: string;
  starts: number[];
  size: number;
  read: (start: Date, end: Date) => Promise<T | null>;
  budgetMs: number;
  concurrency: number;
  /** Buckets that can't be read any more (e.g. reports older than Corteca keeps) are skipped. */
  readable?: (start: number) => boolean;
}): Promise<FillResult<T>> {
  const { source, starts, size } = opts;
  if (!starts.length) return { buckets: [], pending: 0, total: 0, errors: [] };
  const stored = await readBuckets<T>(source, new Date(starts[0]), new Date(starts[starts.length - 1]));
  const now = Date.now();
  const todo = starts
    .filter((s) => !stored.get(new Date(s).toISOString())?.complete)
    .filter((s) => opts.readable?.(s) ?? true)
    .sort((a, b) => b - a);

  const results = await mapLimited(todo, opts.concurrency, now + opts.budgetMs, async (s) => opts.read(new Date(s), new Date(s + size)));
  const fresh: StoredBucket<T>[] = [];
  const errors: string[] = [];
  for (const r of results) {
    if (r.error) { errors.push(r.error); continue; }
    if (r.result == null) continue;
    const b: StoredBucket<T> = { bucket: new Date(r.item).toISOString(), data: r.result, complete: r.item + size + SETTLE_MS < Date.now() };
    fresh.push(b);
    stored.set(b.bucket, b);
  }
  await writeBuckets(source, fresh);

  const done = new Set(results.filter((r) => !r.error && r.result != null).map((r) => r.item));
  const pending = todo.filter((s) => !done.has(s)).length;
  return {
    buckets: [...stored.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    pending,
    total: starts.length,
    errors: [...new Set(errors)].slice(0, 3),
  };
}
