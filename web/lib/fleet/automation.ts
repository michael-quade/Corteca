/**
 * Fleet automation (read-only): proactive reboot rules (`/proactive-engine/rules`, daily
 * `/rules/{id}/trends` with Success / Failure / Skipped counts, per-device `/rules/{id}/reports`
 * CSV) and scheduled speed / latency tests (`/scheduler/schedules`, `/{id}/compliance` — from/to
 * must be ISO date-times —, `/{id}/devices`, `/{id}/reports` CSV with "result: Downstream
 * 104.90 mbps"). Shapes checked on demo2 2026-11-20.
 */
import { parseCsv } from "./csv";

export interface RuleTotals { success: number; failure: number; skipped: number }

export interface RuleRow {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  condition: string;
  scope: string;
  cron: string;
  timeZone: string;
  totals: RuleTotals;
  lastRun: string | null;
}

export interface ScheduleRow {
  id: string;
  name: string;
  testType: string;
  enabled: boolean;
  cron: string;
  timeZone: string;
  devices: number | null;
  compliance: { score: number; nonCompliant: { deviceId: string; subscriberId: string; score: number }[] } | null;
  results: { tests: number; failed: number; perDevice: { subscriberId: string; kind: string; avg: number; unit: string; n: number }[] } | null;
}

export interface AutomationResponse {
  rules: RuleRow[];
  ruleDaily: ({ day: string } & RuleTotals)[];
  schedules: ScheduleRow[];
  errors: string[];
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

const CONDITION: Record<string, (v: string) => string> = {
  UPTIME_HOURS: (v) => `Uptime ≥ ${v} h`,
  CPU_USAGE: (v) => `CPU usage ${v}`,
  MEM_USAGE: (v) => `Memory usage ${v}`,
  RADIO_DOWN: (v) => `Radio down ${v}`,
};

export function parseRule(raw: unknown): Omit<RuleRow, "totals" | "lastRun"> | null {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.rule_id !== "string") return null;
  const cond = (o.condition ?? {}) as { type?: unknown; value?: unknown };
  const model = s(o.model);
  const macs = s(o.maclist);
  return {
    id: o.rule_id, name: s(o.name) || o.rule_id, type: s(o.type), enabled: o.enabled === true,
    condition: (CONDITION[s(cond.type)] ?? ((v: string) => `${s(cond.type)} ${v}`))(s(cond.value)).trim(),
    scope: model && model !== "all" ? model : macs ? `${macs.split(",").length} device${macs.includes(",") ? "s" : ""}` : "All models",
    cron: s(o.cron), timeZone: s(o.tz),
  };
}

/** Trend rows: `{ date: [2026, 11, 20], stats: [{ code: 1000, count, message: "Success" }, …] }`. */
export function parseRuleTrend(raw: unknown): ({ day: string } & RuleTotals)[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((e) => {
    const o = e as { date?: unknown; stats?: unknown };
    if (!Array.isArray(o.date) || o.date.length < 3) return [];
    const [y, m, d] = o.date as number[];
    const day = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const t: RuleTotals = { success: 0, failure: 0, skipped: 0 };
    for (const st of Array.isArray(o.stats) ? o.stats as { message?: unknown; count?: unknown }[] : []) {
      const k = s(st.message).toLowerCase();
      if (k === "success" || k === "failure" || k === "skipped") t[k] += Number(st.count) || 0;
    }
    return [{ day, ...t }];
  });
}

export function parseSchedule(raw: unknown): Pick<ScheduleRow, "id" | "name" | "testType" | "enabled" | "cron" | "timeZone"> | null {
  const o = raw as Record<string, unknown>;
  if (!o || typeof o.schedule_id !== "string") return null;
  const data = (o.data ?? {}) as { test_type?: unknown };
  return { id: o.schedule_id, name: s(o.name) || o.schedule_id, testType: s(data.test_type) || s(o.type), enabled: o.enabled === true, cron: s(o.cron), timeZone: s(o.time_zone) };
}

export function parseCompliance(raw: unknown): ScheduleRow["compliance"] {
  const o = raw as { score?: unknown; non_compliant_devices?: unknown };
  if (!o || typeof o.score !== "number") return null;
  const list = Array.isArray(o.non_compliant_devices) ? o.non_compliant_devices as Record<string, unknown>[] : [];
  return {
    score: o.score,
    nonCompliant: list.map((d) => ({ deviceId: s(d.device_id), subscriberId: s(d.subscriber_id), score: Number(d.score) || 0 })).sort((a, b) => a.score - b.score),
  };
}

const RESULT = /result:\s*(\w+)\s+([\d.]+)\s*(\w+)/i;

/** Schedule report CSV → tests, failures, average result per subscriber and measure (speed: "result: Downstream 104.90 mbps"; latency: Latency ms + jitter). */
export function parseScheduleReport(csv: string): ScheduleRow["results"] {
  const rows = parseCsv(csv).rows;
  if (!rows.length) return null;
  const per = new Map<string, { subscriberId: string; kind: string; unit: string; sum: number; n: number }>();
  let failed = 0;
  const add = (sub: string, kind: string, unit: string, v: number) => {
    const key = `${sub}|${kind}`;
    const cur = per.get(key) ?? { subscriberId: sub, kind, unit, sum: 0, n: 0 };
    cur.sum += v; cur.n++;
    per.set(key, cur);
  };
  for (const r of rows) {
    const sub = r["Subscriber ID"] ?? "";
    // Latency schedules: "Latency" (ms) column, "jitter: 1" comment, Test Status 1 = ok.
    if ("Latency" in r) {
      if (r["Test Status"] !== "1" || !Number.isFinite(Number(r.Latency)) || r.Latency === "") { failed++; continue; }
      add(sub, "Latency", "ms", Number(r.Latency));
      const j = /jitter:\s*([\d.]+)/i.exec(r.Comment ?? "");
      if (j) add(sub, "Jitter", "ms", Number(j[1]));
      continue;
    }
    const m = RESULT.exec(r.Comment ?? "");
    if (!m) { failed++; continue; }
    add(sub, m[1], m[3].replace(/^([kmg])bps$/i, (_, p: string) => `${p.toUpperCase()}bps`), Number(m[2]));
  }
  return {
    tests: rows.length, failed,
    perDevice: [...per.values()].map((p) => ({ subscriberId: p.subscriberId, kind: p.kind, unit: p.unit, avg: p.sum / p.n, n: p.n }))
      .sort((a, b) => a.subscriberId.localeCompare(b.subscriberId) || a.kind.localeCompare(b.kind)),
  };
}

export interface RuleReportRow { mac: string; serial: string; subscriberId: string; at: string; result: string }

export function parseRuleReport(csv: string): RuleReportRow[] {
  return parseCsv(csv).rows.map((r) => ({
    mac: r["MAC Address"] ?? "", serial: r["Serial Number"] ?? "", subscriberId: r.SubscriberID ?? "",
    at: r["Reboot at (Date & time)"] ?? "", result: r.Result ?? "",
  })).filter((r) => r.mac).sort((a, b) => b.at.localeCompare(a.at));
}
