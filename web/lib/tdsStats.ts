// TDS Network Events RCR: date range (presets or a custom range inside the 30 days Corteca
// keeps), filters, P1–P4 buckets (hourly up to 36 h, else daily), CSV with the level.

import { EVENT_DAYS } from "./networkEvents";
import { DAY, HOUR, startOfDay } from "./eventFormat";
import type { Priority } from "./eventPriority";
import type { TdsGroup, TdsItem } from "./tdsEvents";

export type TdsRange = { kind: "preset"; days: 1 | 7 | 30 } | { kind: "custom"; from: number; to: number };
export const TDS_PRESETS: { days: 1 | 7 | 30; label: string }[] = [
  { days: 1, label: "24 h" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" },
];

/** Oldest moment Corteca's activity log covers. */
export const oldestDay = (now: number) => startOfDay(now - EVENT_DAYS * DAY);

export function rangeBounds(r: TdsRange, now: number): { from: number; to: number } {
  if (r.kind === "preset") return { from: now - r.days * DAY, to: now };
  const from = Math.max(oldestDay(now), Math.min(r.from, r.to));
  const to = Math.min(now, Math.max(r.from, r.to));
  return { from, to: Math.max(from, to) };
}

export interface TdsFilter {
  from: number;
  to: number;
  device: string | null;
  routine: boolean;
  priorities: Set<Priority>;
  groups: Set<TdsGroup>;
}

/** The row overlaps [from, to] (an outage that began earlier but ended inside counts). */
const inRange = (it: TdsItem, from: number, to: number) => (it.end ?? it.start) >= from && it.start <= to;

/** Range + device + routine: what the chip counts are taken from. */
export function tdsScope(items: TdsItem[], f: Pick<TdsFilter, "from" | "to" | "device" | "routine">): TdsItem[] {
  return items.filter((it) => inRange(it, f.from, f.to) && (!f.device || it.device === f.device) && (f.routine || it.kind !== "routine"));
}

/** Rows that pass every filter: the chart, timeline, tiles, list and CSV all use these. */
export const tdsVisible = (scoped: TdsItem[], f: Pick<TdsFilter, "priorities" | "groups">) =>
  scoped.filter((it) => f.priorities.has(it.priority) && f.groups.has(it.group));

/** Priority counts within the selected categories; category counts within the selected levels. */
export function tdsCounts(scoped: TdsItem[], f: Pick<TdsFilter, "priorities" | "groups">) {
  const priorities = new Map<Priority, number>();
  const groups = new Map<TdsGroup, number>();
  for (const it of scoped) {
    if (f.groups.has(it.group)) priorities.set(it.priority, (priorities.get(it.priority) ?? 0) + 1);
    if (f.priorities.has(it.priority)) groups.set(it.group, (groups.get(it.group) ?? 0) + 1);
  }
  return { priorities, groups };
}

export interface TdsBucket { start: number; end: number; counts: [number, number, number, number] }

/** One bucket per hour for ranges up to 36 h, else per calendar day; oldest first. */
export function tdsBuckets(items: TdsItem[], from: number, to: number): { buckets: TdsBucket[]; hourly: boolean } {
  const hourly = to - from <= 36 * HOUR;
  const buckets: TdsBucket[] = [];
  if (hourly) {
    const first = Math.floor(from / HOUR) * HOUR;
    for (let t = first; t <= to; t += HOUR) buckets.push({ start: t, end: t + HOUR, counts: [0, 0, 0, 0] });
  } else {
    for (let d = startOfDay(from); d <= to; d = startOfDay(d + DAY + HOUR)) buckets.push({ start: d, end: startOfDay(d + DAY + HOUR), counts: [0, 0, 0, 0] });
  }
  for (const it of items) {
    const t = Math.max(it.start, from);
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) b.counts[it.priority - 1]++;
  }
  return { buckets, hourly };
}

/** P1 / P2 rows in the last 24 h (no routine reports) — the drawer's "N today" pill. */
export const tdsToday = (items: TdsItem[], now: number) =>
  items.filter((it) => it.priority <= 2 && it.kind !== "routine" && inRange(it, now - DAY, now)).length;

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Every Corteca event behind the listed rows, with the row's and the event's own level. */
export function tdsCsv(items: TdsItem[], nameOf: (mac: string | null) => string, eventLevel: (it: TdsItem, i: number) => Priority): string {
  const rows = [["Time (UTC)", "Row severity", "Event severity", "Category", "Summary", "Corteca operation", "Device", "Device MAC", "Origin", "Details"]];
  for (const item of items) {
    item.events.forEach((e, i) => {
      rows.push([
        new Date(e.at).toISOString(), `P${item.priority}`, `P${eventLevel(item, i)}`, item.group, item.title, e.operation,
        nameOf(e.device), e.device ?? "", [e.originType, e.originId].filter(Boolean).join(" "),
        Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join("; "),
      ]);
    });
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
