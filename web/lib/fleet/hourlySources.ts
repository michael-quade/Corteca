/** Server: the two hourly cluster sources (alarms, events) — how to read one hour and fill a range. */
import { summariseAlarmCsv, type AlarmHour } from "./alarms";
import { summariseEventCsv, type EventHour } from "./clusterEvents";
import { cortecaGet, ouifeTime } from "./cortecaRead";
import { DAY, HOUR, bucketStarts, fillBuckets, type FillResult } from "./fillBuckets";

export type HourlySource = "alarms" | "events";

function hourPath(source: HourlySource, start: Date, end: Date): string {
  // End one second before the next hour so neighbouring hours don't share rows.
  const range = `date_start=${ouifeTime(start)}&date_end=${ouifeTime(new Date(end.getTime() - 1000))}`;
  return source === "alarms"
    ? `/ouife/alarms/history/ouifeapi?${range}&isCustomAlarm=False`
    : `/ouife/events/ouifeapi?${range}`;
}

export async function readHour(source: HourlySource, base: string, token: string, start: Date, end: Date): Promise<AlarmHour | EventHour> {
  const csv = await cortecaGet(base, token, hourPath(source, start, end), { csv: true, timeoutMs: 60_000 });
  return source === "alarms" ? summariseAlarmCsv(csv) : summariseEventCsv(csv);
}

/**
 * Fills `source` within `budgetMs`, newest first: the last 24 hours for days = 1, otherwise
 * whole UTC days — today so far and the `days` − 1 days before — so no chart starts with a part-day.
 */
export function fillHours<T extends AlarmHour | EventHour>(source: HourlySource, base: string, token: string, days: number, budgetMs: number, concurrency = 6): Promise<FillResult<T>> {
  const now = Date.now();
  return fillBuckets<T>({
    source: `ouife:${source}`,
    starts: bucketStarts(days > 1 ? Math.floor(now / DAY) * DAY - (days - 1) * DAY : now - 23 * HOUR, now, HOUR),
    size: HOUR,
    read: (s, e) => readHour(source, base, token, s, e) as Promise<T>,
    budgetMs,
    concurrency,
  });
}
