/**
 * Cluster events from `/ouife/events/ouifeapi` (CSV, no device = whole cluster): the radio /
 * configuration changes Corteca's RRM and APs log — power, channel, bandwidth, radio on/off,
 * DFS radar, reboots. Times are UTC ("2026-11-20 08:32 PM"; time_zone names the AP's zone).
 * Same ~10,000-row cap as the alarm history, so it is read hour by hour. Some messages span
 * several lines unquoted, so a record starts at the line holding `,<timestamp>,`, and the
 * fields after the timestamp are read from both ends (the message may contain commas).
 */
import { normaliseMac } from "./links";
import { ROW_CAP } from "./alarms";

const RECORD = /,(\d{4}-\d\d-\d\d \d\d:\d\d [AP]M),/;

export interface EventRecord { primMac: string; tag: string; model: string; customerId: string }

export function parseClusterEvents(text: string): EventRecord[] {
  const lines = text.split(/\r?\n/);
  const out: EventRecord[] = [];
  for (const line of lines.slice(1)) {
    const m = RECORD.exec(line);
    if (!m) continue;
    const f = line.slice(m.index + m[0].length).split(",");
    if (f.length < 20) continue;
    const n = f.length;
    out.push({ primMac: f[1] ?? "", tag: (f[n - 6] ?? "").trim() || "Other", model: (f[n - 2] ?? "").trim(), customerId: (f[n - 3] ?? "").trim() });
  }
  return out;
}

/**
 * Event groups, most significant first: an event's tag can be several joined by ";"
 * ("Channel Changed;Power Changed"), and it counts once, in the first group any of its tags
 * belongs to. Power changes and threshold notices are routine RRM chatter (most of the log).
 */
export const EVENT_GROUPS = [
  { id: "dfs", label: "DFS radar", routine: false, tags: ["DFS Radar Detected"] },
  { id: "reboot", label: "Reboots", routine: false, tags: ["Network Device Reboot"] },
  { id: "radio", label: "Radio on / off", routine: false, tags: ["WiFi Radio Enabled", "WiFi Radio Disabled"] },
  { id: "channel", label: "Channel / bandwidth", routine: false, tags: ["Channel Changed", "Channel Set Selection Changed", "Bandwidth Changed", "Try 160MHz", "Initial Channel Selection Success", "Initial Channel Selection Fail", "DFS Channel Available", "ICS skipped due to LCME", "Radio Change OutOfSync"] },
  { id: "threshold", label: "Thresholds exceeded", routine: true, tags: ["Threshold Exceeded"] },
  { id: "power", label: "Power changes", routine: true, tags: ["Power Changed"] },
] as const;
export type EventGroup = (typeof EVENT_GROUPS)[number]["id"] | "other";

export function eventGroup(tag: string): EventGroup {
  const parts = tag.split(";").map((t) => t.trim());
  return EVENT_GROUPS.find((g) => parts.some((p) => (g.tags as readonly string[]).includes(p)))?.id ?? "other";
}

export const ROUTINE_GROUPS: EventGroup[] = ["threshold", "power", "other"];

export interface EventHour {
  rows: number;
  truncated: boolean;
  tags: Record<string, number>;
  /** Per AP (primary MAC): events per group, model, customer ID. */
  aps: Record<string, { g: Partial<Record<EventGroup, number>>; m: string; u: string }>;
}

export function summariseEventCsv(text: string): EventHour {
  const recs = parseClusterEvents(text);
  const out: EventHour = { rows: recs.length, truncated: recs.length >= ROW_CAP, tags: {}, aps: {} };
  for (const r of recs) {
    out.tags[r.tag] = (out.tags[r.tag] ?? 0) + 1;
    if (!r.primMac) continue;
    const mac = normaliseMac(r.primMac);
    const ap = (out.aps[mac] ??= { g: {}, m: r.model, u: r.customerId });
    const g = eventGroup(r.tag);
    ap.g[g] = (ap.g[g] ?? 0) + 1;
  }
  return out;
}

type GroupCounts = Partial<Record<EventGroup, number>>;

export interface EventsResponse {
  bucket: "hour" | "day";
  series: ({ t: string } & GroupCounts)[];
  totals: GroupCounts & { rows: number };
  tags: { tag: string; count: number }[];
  aps: ({ mac: string; model: string; customerId: string; total: number } & GroupCounts)[];
  truncatedHours: number;
  hoursRead: number;
  pending: number;
  total: number;
  errors: string[];
}

export function mergeEventHours(hours: { bucket: string; data: EventHour }[], byDay: boolean): Omit<EventsResponse, "pending" | "total" | "errors"> {
  const series = new Map<string, GroupCounts>();
  const totals: GroupCounts & { rows: number } = { rows: 0 };
  const tags = new Map<string, number>();
  const aps = new Map<string, EventsResponse["aps"][number]>();
  let truncatedHours = 0;
  for (const { bucket, data } of hours) {
    const key = byDay ? `${bucket.slice(0, 10)}T00:00:00.000Z` : bucket;
    const s = series.get(key) ?? {};
    totals.rows += data.rows;
    if (data.truncated) truncatedHours++;
    for (const [tag, n] of Object.entries(data.tags)) {
      tags.set(tag, (tags.get(tag) ?? 0) + n);
      const g = eventGroup(tag);
      s[g] = (s[g] ?? 0) + n;
      totals[g] = (totals[g] ?? 0) + n;
    }
    series.set(key, s);
    for (const [mac, a] of Object.entries(data.aps)) {
      const cur = aps.get(mac) ?? { mac, model: a.m, customerId: a.u, total: 0 };
      for (const [g, n] of Object.entries(a.g) as [EventGroup, number][]) {
        cur[g] = (cur[g] ?? 0) + n;
        if (!ROUTINE_GROUPS.includes(g)) cur.total += n;
      }
      aps.set(mac, cur);
    }
  }
  return {
    bucket: byDay ? "day" : "hour",
    series: [...series].sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({ t, ...c })),
    totals,
    tags: [...tags].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
    aps: [...aps.values()].filter((a) => a.total > 0).sort((a, b) => b.total - a.total).slice(0, 500),
    truncatedHours,
    hoursRead: hours.length,
  };
}
