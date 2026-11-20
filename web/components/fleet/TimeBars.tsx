"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtInt } from "@/web/lib/fleet/labels";

export interface TimeSeries { key: string; label: string; color: string }
export type TimeRow = { t: string } & Record<string, number | string | undefined>;

/** "Nov 14" for days, "Nov 14, 6 AM" for hours (UTC, as Corteca logs). */
export function timeLabel(t: string, hourly: boolean): string {
  const d = new Date(t.length === 10 ? `${t}T00:00:00Z` : t);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return hourly ? `${day}, ${d.toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" })}` : day;
}

function TimeTip({ active, payload, series, hourly, unit }: { active?: boolean; payload?: { payload: TimeRow }[]; series: TimeSeries[]; hourly: boolean; unit?: string }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const total = series.reduce((a, s) => a + (Number(row[s.key]) || 0), 0);
  return (
    <div className="min-w-[190px] rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200">
      <p className="font-semibold text-neutral-900">{timeLabel(row.t, hourly)}{hourly ? " UTC" : ""}</p>
      <ul className="mt-1 space-y-0.5">
        {[...series].reverse().map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-neutral-900">{fmtInt(Number(row[s.key]) || 0)}{unit ?? ""}</span>
          </li>
        ))}
      </ul>
      {series.length > 1 && <p className="mt-1 border-t border-neutral-100 pt-1 text-neutral-500">Total {fmtInt(total)}{unit ?? ""}</p>}
    </div>
  );
}

/**
 * Stacked bars over time (hours or days), one scale, legend under the chart. Bucket `t` is an
 * ISO time or a yyyy-mm-dd day. Rows with no data (a day never stored) draw as gaps.
 */
export function TimeBars({ rows, series, hourly = false, height = 240, unit }: {
  rows: TimeRow[];
  series: TimeSeries[];
  hourly?: boolean;
  height?: number;
  unit?: string;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-neutral-500">No data for this range yet.</p>;
  const ticks = Math.max(1, Math.ceil(rows.length / 8));
  return (
    <div>
      <div style={{ height }} className="w-full [&_svg:focus]:outline-none [&_svg_*:focus]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="18%" accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis
              dataKey="t" tickLine={false} axisLine={{ stroke: "#d4d4d4" }} interval={ticks - 1}
              tick={{ fontSize: 11, fill: "#525252" }}
              tickFormatter={(t: string) => hourly ? new Date(t).toLocaleTimeString("en-US", { hour: "numeric", timeZone: "UTC" }) : timeLabel(t, false)}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737373" }} width={48} allowDecimals={false} tickFormatter={(v: number) => fmtInt(v)} />
            <Tooltip content={<TimeTip series={series} hourly={hourly} unit={unit} />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} stackId="t" fill={s.color} isAnimationActive={false}
                stroke="#fff" strokeWidth={series.length > 1 ? 1 : 0} radius={i === series.length - 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-700">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />{s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
