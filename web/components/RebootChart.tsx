"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export type RebootRow = Record<string, string>;

// Find the first key whose lowercase form contains any candidate substring
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
      {sub && <p className="mt-1 truncate text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

const ORIGIN_PALETTE: Record<string, string> = {
  USER: "#3b82f6", AGENT: "#a855f7", DEVICE: "#f97316", MESHNETWORK: "#14b8a6",
};

export function RebootChart({ rows }: { rows: RebootRow[] }) {
  if (rows.length === 0) return null;

  const keys      = Object.keys(rows[0]);
  const tsKey     = findField(keys, "timestamp", "time", "date", "created", "event");
  const deviceKey = findField(keys, "device_id", "device", "mac", "node");
  const originKey = findField(keys, "origin", "source", "trigger", "cause", "reason");
  const netKey    = findField(keys, "network", "home_wifi", "wifi_id");

  // Coerce any field value to a plain string (API may return numbers/objects)
  function str(v: unknown): string {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return JSON.stringify(v);
  }

  // Daily counts
  const byDay: Record<string, number> = {};
  if (tsKey) {
    for (const r of rows) {
      const day = str(r[tsKey]).slice(0, 10);
      if (day) byDay[day] = (byDay[day] ?? 0) + 1;
    }
  }
  const dailyData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count,
    }));

  // Origin breakdown
  const byOrigin: Record<string, number> = {};
  if (originKey) {
    for (const r of rows) {
      const k = str(r[originKey]) || "UNKNOWN";
      byOrigin[k] = (byOrigin[k] ?? 0) + 1;
    }
  }
  const originData = Object.entries(byOrigin).map(([name, count]) => ({ name, count }));

  // Summary stats
  const deviceCounts: Record<string, number> = {};
  if (deviceKey) {
    for (const r of rows) {
      const k = str(r[deviceKey]);
      if (k) deviceCounts[k] = (deviceCounts[k] ?? 0) + 1;
    }
  }
  const topDevice = Object.entries(deviceCounts).sort(([, a], [, b]) => b - a)[0];
  const timestamps = tsKey ? rows.map((r) => str(r[tsKey!])).filter(Boolean).sort() : [];
  const mostRecent = timestamps.at(-1) ? new Date(timestamps.at(-1)!).toLocaleString() : "—";
  const uniqueNets = netKey ? new Set(rows.map((r) => str(r[netKey!])).filter(Boolean)).size : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Reboots" value={rows.length} />
        <StatCard label="Most Recent" value={mostRecent} />
        <StatCard label="Top Device" value={topDevice ? topDevice[1] : "—"} sub={topDevice?.[0]} />
        <StatCard label="Unique Networks" value={uniqueNets} />
      </div>

      {dailyData.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-neutral-800">Reboots Per Day</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" name="Reboots" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {originData.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="mb-4 text-sm font-semibold text-neutral-800">Reboots by Origin</p>
          <ResponsiveContainer width="100%" height={Math.max(120, originData.length * 40)}>
            <BarChart data={originData} layout="vertical" margin={{ top: 0, right: 24, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f3f4f6" }} />
              <Bar dataKey="count" name="Reboots" radius={[0, 4, 4, 0]}>
                {originData.map((e) => <Cell key={e.name} fill={ORIGIN_PALETTE[e.name] ?? "#94a3b8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
