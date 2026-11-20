"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtInt } from "@/web/lib/fleet/labels";

export interface HBarSeries { key: string; label: string; color: string }
export type HBarRow = { label: string; sub?: string } & Record<string, number | string | undefined>;

interface TipProps {
  active?: boolean;
  payload?: { payload: HBarRow }[];
  series: HBarSeries[];
  unit?: string;
}

function BarTip({ active, payload, series, unit }: TipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const fmt = (v: unknown) => `${typeof v === "number" ? (Number.isInteger(v) ? fmtInt(v) : v.toFixed(1)) : "—"}${unit ?? ""}`;
  return (
    <div className="min-w-[180px] rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200">
      <p className="font-semibold text-neutral-900">{row.label}</p>
      {row.sub && <p className="text-neutral-500">{row.sub}</p>}
      <ul className="mt-1 space-y-0.5">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-neutral-700">
            {series.length > 1 && <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />}
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-neutral-900">{fmt(row[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Horizontal bars, one row per item, on one scale (optionally stacked). Labels on the left,
 * hover for values; a legend under the chart when there is more than one series.
 */
export function HBarChart({ rows, series, unit, max, labelWidth = 170 }: {
  rows: HBarRow[];
  series: HBarSeries[];
  unit?: string;
  /** Fixed scale end (e.g. 100 for percentages). */
  max?: number;
  labelWidth?: number;
}) {
  if (!rows.length) return <p className="py-6 text-sm text-neutral-500">Nothing to show for this range.</p>;
  const height = rows.length * 28 + 36;
  return (
    <div>
      <div style={{ height }} className="w-full [&_svg:focus]:outline-none [&_svg_*:focus]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap="28%" accessibilityLayer={false}>
            <CartesianGrid horizontal={false} stroke="#eef0f3" />
            <XAxis
              type="number" domain={[0, max ?? "auto"]} tickLine={false} axisLine={false}
              tick={{ fontSize: 11, fill: "#737373" }} allowDecimals={false}
              tickFormatter={(v: number) => `${fmtInt(v)}${unit ?? ""}`}
            />
            <YAxis
              type="category" dataKey="label" width={labelWidth} tickLine={false} axisLine={false}
              tick={{ fontSize: 12, fill: "#404040" }} interval={0}
            />
            <Tooltip content={<BarTip series={series} unit={unit} />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
            {series.map((s, i) => (
              <Bar
                key={s.key} dataKey={s.key} stackId="a" fill={s.color} isAnimationActive={false}
                stroke="#fff" strokeWidth={series.length > 1 ? 1 : 0}
                radius={i === series.length - 1 ? [0, 4, 4, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-700">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
