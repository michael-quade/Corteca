"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import type { ReportTypeConfig } from "@/web/lib/reportTypes";

export type ReportRow = Record<string, unknown>;

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function findField(keys: string[], ...candidates: string[]): string | undefined {
  const lc = keys.map((k) => k.toLowerCase());
  for (const c of candidates) {
    const i = lc.findIndex((k) => k.includes(c));
    if (i >= 0) return keys[i];
  }
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1.5 truncate text-3xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="mt-1 truncate font-mono text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

interface ReportChartProps {
  rows: ReportRow[];
  config: ReportTypeConfig;
  dateRange?: { start: string; end: string };
}

export function ReportChart({ rows, config, dateRange }: ReportChartProps) {
  if (rows.length === 0) return null;

  const keys      = Object.keys(rows[0]);
  const tsKey     = findField(keys, "timestamp", "time", "date", "created", "event", "at");
  const deviceKey = findField(keys, "device_id", "device", "mac", "node", "ap_id");
  const netKey    = findField(keys, "network_id", "network", "home_wifi", "wifi_id");
  const groupKey  = findField(keys, ...config.groupByHints);

  // Daily counts
  const byDay: Record<string, number> = {};
  if (tsKey) {
    for (const r of rows) {
      const day = toStr(r[tsKey]).slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
    }
  }
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    }));

  // Group-by counts (e.g. by origin, channel, band, status…)
  const byGroup: Record<string, number> = {};
  if (groupKey) {
    for (const r of rows) {
      const k = toStr(r[groupKey]) || "UNKNOWN";
      byGroup[k] = (byGroup[k] ?? 0) + 1;
    }
  }
  const groupData = Object.entries(byGroup)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));

  // Summary stats
  const deviceSet = new Set<string>();
  if (deviceKey) {
    for (const r of rows) { const v = toStr(r[deviceKey]); if (v) deviceSet.add(v); }
  }
  const netSet = new Set<string>();
  if (netKey) {
    for (const r of rows) { const v = toStr(r[netKey]); if (v) netSet.add(v); }
  }
  const timestamps = tsKey ? rows.map((r) => toStr(r[tsKey!])).filter(Boolean).sort() : [];
  const mostRecent = timestamps.at(-1) ? new Date(timestamps.at(-1)!).toLocaleString() : "—";

  const chartColor = config.color;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Events" value={rows.length} />
        <StatCard label="Most Recent" value={mostRecent} />
        <StatCard label="Unique Devices" value={deviceSet.size || "—"} />
        <StatCard label="Unique Networks" value={netSet.size || (dateRange ? `${dateRange.start.slice(0,10)} → ${dateRange.end.slice(0,10)}` : "—")} />
      </div>

      {/* Daily trend */}
      {dailyData.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-neutral-800">Events Per Day</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" name="Events" fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Group breakdown */}
      {groupData.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-neutral-800">
            Events by {groupKey?.replace(/_/g, " ") ?? "Category"}
          </p>
          <ResponsiveContainer width="100%" height={Math.max(140, groupData.length * 36)}>
            <BarChart data={groupData} layout="vertical" margin={{ top: 0, right: 24, left: 100, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} width={96} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" name="Events" radius={[0, 4, 4, 0]}>
                {groupData.map((_, i) => (
                  <Cell key={i} fill={chartColor} fillOpacity={1 - i * 0.06} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
