/**
 * Daily trends from Corteca's daily report CSVs (`/measures/reports` lists them; Corteca keeps
 * only the last 7 days — demo2 2026-11-20 — so each day is summarised once and kept as a
 * `report:<type>` rollup, letting the trend grow past 7 days as the daily cron runs).
 * Columns checked on demo2: reboot DEVICEID, MODEL, TIMESTAMP, TIMEOFF[s], REASON;
 * cloud_disconnection / new_device / claim DEVICEID, MODEL, TIMESTAMP; backhaul DEVICEID,
 * NETWORKID, STATE (POOR), STARTTIME, ENDTIME; shaped_event per device/hour counts.
 */
import { parseCsv } from "./csv";
import { normaliseMac } from "./links";

export const TREND_TYPES = ["reboot", "cloud_disconnection", "new_device", "claim", "backhaul", "shaped_event"] as const;
export type TrendType = (typeof TREND_TYPES)[number];

export function isTrendType(v: string): v is TrendType {
  return (TREND_TYPES as readonly string[]).includes(v);
}

export const SHAPED_COLUMNS = ["ASSOC-DISASSOC", "DHCP-ACK", "RSSI-THRESHOLD", "MESH", "ETHERNET-STATION", "FAILED-STATION", "MISCELLANEOUS"] as const;

export interface DaySummary {
  /** Rows = events (reboot, disconnection, new device, claim) or episodes (backhaul). */
  events: number;
  devices: number;
  /** Per device, top 50 (reboot / cloud_disconnection) — lets the page leave out noisy devices. */
  top?: Record<string, number>;
  /** reboot: per REASON. shaped_event: per column. */
  parts?: Record<string, number>;
  models?: Record<string, number>;
}

function bump(m: Record<string, number>, k: string, n = 1) { m[k] = (m[k] ?? 0) + n; }

function topN(m: Record<string, number>, n: number): Record<string, number> {
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n));
}

export function summariseReport(type: TrendType, csv: string): DaySummary {
  const { rows } = parseCsv(csv);
  const perDevice: Record<string, number> = {};
  const models: Record<string, number> = {};
  const parts: Record<string, number> = {};
  for (const r of rows) {
    const dev = normaliseMac(r.DEVICEID ?? r.NETWORKID ?? "");
    if (!dev) continue;
    bump(perDevice, dev);
    if (r.MODEL) bump(models, r.MODEL);
    if (type === "reboot") bump(parts, r.REASON || "Unknown");
    if (type === "shaped_event") for (const c of SHAPED_COLUMNS) bump(parts, c, Number(r[c]) || 0);
  }
  const out: DaySummary = { events: Object.values(perDevice).reduce((a, b) => a + b, 0), devices: Object.keys(perDevice).length, models: topN(models, 30) };
  if (type === "reboot" || type === "cloud_disconnection") out.top = topN(perDevice, 50);
  if (type === "reboot" || type === "shaped_event") out.parts = parts;
  return out;
}

export interface ReportListEntry { type: string; day: string; href: string }

export function parseReportList(raw: unknown): ReportListEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    const o = e as { type?: unknown; href?: unknown; date_range?: { start_date?: unknown } };
    const day = typeof o.date_range?.start_date === "string" ? o.date_range.start_date.slice(0, 10) : "";
    return typeof o.type === "string" && typeof o.href === "string" && day ? [{ type: o.type, day, href: o.href }] : [];
  });
}

export interface TrendDay { day: string; summary: DaySummary | null }

export interface ReportTrendResponse {
  days: string[];
  types: Partial<Record<TrendType, TrendDay[]>>;
  pending: number;
  total: number;
  errors: string[];
}
