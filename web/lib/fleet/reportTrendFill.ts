/** Server: reads and stores daily report summaries for the report trends. */
import { cortecaGet, cortecaJson } from "./cortecaRead";
import { DAY, bucketStarts, fillBuckets } from "./fillBuckets";
import { parseReportList, summariseReport, type DaySummary, type ReportListEntry, type ReportTrendResponse, type TrendType } from "./reportTrend";

let listCache: { at: number; base: string; list: ReportListEntry[] } | null = null;

async function reportList(base: string, token: string): Promise<ReportListEntry[]> {
  if (listCache && listCache.base === base && Date.now() - listCache.at < 10 * 60_000) return listCache.list;
  const list = parseReportList(await cortecaJson(base, token, "/measures/reports?page=0&size=210&shard_id=1"));
  listCache = { at: Date.now(), base, list };
  return list;
}

/** Days `days` back to yesterday (UTC), as bucket starts — reports cover whole past days. */
export function trendDayStarts(days: number, now = Date.now()): number[] {
  const today = Math.floor(now / DAY) * DAY;
  return bucketStarts(today - days * DAY, today - DAY, DAY);
}

export async function fillReportTrends(base: string, token: string, types: TrendType[], days: number, budgetMs: number): Promise<ReportTrendResponse> {
  const list = await reportList(base, token);
  const starts = trendDayStarts(days);
  const out: ReportTrendResponse = { days: starts.map((s) => new Date(s).toISOString().slice(0, 10)), types: {}, pending: 0, total: 0, errors: [] };

  await Promise.all(types.map(async (type) => {
    const hrefByDay = new Map(list.filter((e) => e.type === type).map((e) => [e.day, e.href]));
    const fill = await fillBuckets<DaySummary>({
      source: `report:${type}`,
      starts,
      size: DAY,
      readable: (s) => hrefByDay.has(new Date(s).toISOString().slice(0, 10)),
      read: async (s) => {
        const href = hrefByDay.get(s.toISOString().slice(0, 10));
        if (!href) return null;
        return summariseReport(type, await cortecaGet(base, token, `/measures${href}?shard_id=1`, { csv: true, timeoutMs: 60_000 }));
      },
      budgetMs,
      concurrency: 3,
    });
    const byDay = new Map(fill.buckets.map((b) => [b.bucket.slice(0, 10), b.data]));
    out.types[type] = out.days.map((day) => ({ day, summary: byDay.get(day) ?? null }));
    out.pending += fill.pending;
    out.total += fill.total;
    out.errors.push(...fill.errors);
  }));
  return out;
}
