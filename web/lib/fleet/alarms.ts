/**
 * Fleet alarm history from `/ouife/alarms/history/ouifeapi` (cluster CSV, one row per alarm
 * change: ap, category, severity CRITICAL / MAJOR / MINOR / CLEAR, created_time "2026-11-14 04:32 AM"
 * UTC, model, cusId). The CSV stops at ~10,000 rows without saying so (7 days asked → 4.5 h
 * returned on demo2), so it is read hour by hour and each hour reduced to an `AlarmHour`.
 */
import { parseCsv } from "./csv";
import { normaliseMac } from "./links";

export const SEVERITIES = ["CRITICAL", "MAJOR", "MINOR", "CLEAR"] as const;
export type Severity = (typeof SEVERITIES)[number];
type SevCounts = Partial<Record<Severity, number>>;

/** Rows at or above this mean the hour was probably cut off by Corteca's cap. */
export const ROW_CAP = 9_900;

export interface AlarmHour {
  rows: number;
  truncated: boolean;
  sev: SevCounts;
  cat: Record<string, SevCounts>;
  /** Per AP: raised (non-clear) changes, critical ones, model, customer ID. */
  aps: Record<string, { n: number; c: number; m: string; u: string }>;
}

function sevOf(v: string): Severity | null {
  const s = v.trim().toUpperCase();
  return (SEVERITIES as readonly string[]).includes(s) ? (s as Severity) : null;
}

export function summariseAlarmCsv(text: string): AlarmHour {
  const { rows } = parseCsv(text);
  const out: AlarmHour = { rows: rows.length, truncated: rows.length >= ROW_CAP, sev: {}, cat: {}, aps: {} };
  for (const r of rows) {
    const sev = sevOf(r.severity ?? "");
    if (!sev) continue;
    const cat = r.category || "other";
    out.sev[sev] = (out.sev[sev] ?? 0) + 1;
    const c = (out.cat[cat] ??= {});
    c[sev] = (c[sev] ?? 0) + 1;
    if (sev === "CLEAR" || !r.ap) continue;
    const mac = normaliseMac(r.ap);
    const ap = (out.aps[mac] ??= { n: 0, c: 0, m: r.model ?? "", u: r.cusId ?? "" });
    ap.n++;
    if (sev === "CRITICAL") ap.c++;
  }
  return out;
}

export interface AlarmsResponse {
  bucket: "hour" | "day";
  series: ({ t: string } & SevCounts)[];
  totals: SevCounts & { rows: number };
  categories: ({ category: string } & SevCounts)[];
  aps: { mac: string; model: string; customerId: string; raised: number; critical: number }[];
  truncatedHours: number;
  hoursRead: number;
  pending: number;
  total: number;
  errors: string[];
}

export function mergeAlarmHours(hours: { bucket: string; data: AlarmHour }[], byDay: boolean): Omit<AlarmsResponse, "pending" | "total" | "errors"> {
  const series = new Map<string, SevCounts>();
  const totals: SevCounts & { rows: number } = { rows: 0 };
  const cats = new Map<string, SevCounts>();
  const aps = new Map<string, AlarmsResponse["aps"][number]>();
  let truncatedHours = 0;
  for (const { bucket, data } of hours) {
    const key = byDay ? `${bucket.slice(0, 10)}T00:00:00.000Z` : bucket;
    const s = series.get(key) ?? {};
    totals.rows += data.rows;
    if (data.truncated) truncatedHours++;
    for (const sev of SEVERITIES) {
      const n = data.sev[sev] ?? 0;
      s[sev] = (s[sev] ?? 0) + n;
      totals[sev] = (totals[sev] ?? 0) + n;
    }
    series.set(key, s);
    for (const [cat, counts] of Object.entries(data.cat)) {
      const c = cats.get(cat) ?? {};
      for (const sev of SEVERITIES) c[sev] = (c[sev] ?? 0) + (counts[sev] ?? 0);
      cats.set(cat, c);
    }
    for (const [mac, a] of Object.entries(data.aps)) {
      const cur = aps.get(mac) ?? { mac, model: a.m, customerId: a.u, raised: 0, critical: 0 };
      cur.raised += a.n;
      cur.critical += a.c;
      aps.set(mac, cur);
    }
  }
  return {
    bucket: byDay ? "day" : "hour",
    series: [...series].sort(([a], [b]) => a.localeCompare(b)).map(([t, c]) => ({ t, ...c })),
    totals,
    categories: [...cats].map(([category, c]) => ({ category, ...c }))
      .sort((a, b) => raised(b) - raised(a)),
    aps: [...aps.values()].sort((a, b) => b.raised - a.raised),
    truncatedHours,
    hoursRead: hours.length,
  };
}

export const raised = (c: SevCounts) => (c.CRITICAL ?? 0) + (c.MAJOR ?? 0) + (c.MINOR ?? 0);

/** "cloudConnectionLost" → "Cloud connection lost", "noiseInterference2G" → "Noise interference 2.4G". */
export function categoryLabel(cat: string): string {
  const spaced = cat.replace(/2G\b/, " 2.4G").replace(/([a-z])([A-Z0-9])/g, "$1 $2").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase().replace(/ (\d)/g, " $1").replace(/(\d)g\b/g, "$1G");
}
