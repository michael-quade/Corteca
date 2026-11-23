"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";
import { GATEWAY_KINDS, GATEWAY_KIND_META, pct, type ApBucket, type ApMeasure, type GatewayKind } from "@/web/lib/homeApStats";
import { GATEWAY_COLOR } from "./gatewayColors";

interface TipProps { active?: boolean; payload?: { payload: ApBucket }[]; total: number; measure: ApMeasure }

function BucketTip({ active, payload, total, measure }: TipProps) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;
  return (
    <div className="min-w-[200px] rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200">
      <p className="font-semibold text-neutral-900">
        {b.label} {measure === "online" ? "online " : ""}WiFi device{b.label === "1" ? "" : "s"} · {b.homes.toLocaleString()} homes
        <span className="ml-1 font-normal text-neutral-500">({pct(b.homes, total)})</span>
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {GATEWAY_KINDS.filter((k) => b[k] > 0).map((k) => (
          <li key={k} className="flex items-center gap-2 text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: GATEWAY_COLOR[k] }} />
            <span className="flex-1">{GATEWAY_KIND_META[k].label}</span>
            <span className="tabular-nums text-neutral-900">{b[k].toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-neutral-500">Click to list these homes</p>
    </div>
  );
}

/**
 * Homes by number of WiFi devices (gateway + Beacons) — configured, or online now — each bar
 * stacked by gateway type, total on top. A click picks the bucket (filters the table); the others fade.
 */
export function ApCountChart({ buckets, total, measure, selected, onSelect }: {
  buckets: ApBucket[];
  total: number;
  measure: ApMeasure;
  selected: number | null;
  onSelect: (bucket: number | null) => void;
}) {
  const kinds = GATEWAY_KINDS.filter((k) => buckets.some((b) => b[k] > 0));
  // Each bar's total sits on its top non-empty segment, which also gets the rounded end.
  const topKind = buckets.map((b) => [...kinds].reverse().find((k) => b[k] > 0));
  const pick = (state: { activeLabel?: unknown } | null) => {
    const b = buckets.find((x) => x.label === String(state?.activeLabel ?? ""));
    if (b) onSelect(selected === b.bucket ? null : b.bucket);
  };

  return (
    <div className="h-[260px] w-full [&_svg:focus]:outline-none [&_svg_*:focus]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 22, right: 8, bottom: 18, left: 0 }} barCategoryGap="22%" onClick={pick} style={{ cursor: "pointer" }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis
            dataKey="label" tickLine={false} axisLine={{ stroke: "#d4d4d4" }}
            tick={{ fontSize: 12, fill: "#525252" }}
            label={{ value: measure === "online" ? "Online WiFi devices in the home" : "WiFi devices in the home", position: "insideBottom", offset: -12, fontSize: 12, fill: "#737373" }}
          />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737373" }} width={44} allowDecimals={false} />
          <Tooltip content={<BucketTip total={total} measure={measure} />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
          {kinds.map((k: GatewayKind) => (
            <Bar
              key={k} dataKey={k} stackId="homes" fill={GATEWAY_COLOR[k]} stroke="#fff" strokeWidth={1}
              isAnimationActive={false}
            >
              {buckets.map((b, i) => (
                <Cell
                  key={b.bucket} fillOpacity={selected != null && selected !== b.bucket ? 0.25 : 1}
                  // Recharts passes Cell props to the bar shape, radius included.
                  {...({ radius: topKind[i] === k ? [4, 4, 0, 0] : 0 } as object)}
                />
              ))}
              <LabelList
                // By label, not p.index: Recharts skips empty segments, so the index shifts after a 0.
                dataKey="label"
                content={(p) => {
                  const i = buckets.findIndex((b) => b.label === String(p.value));
                  if (i < 0 || topKind[i] !== k) return null;
                  const x = Number(p.x) + Number(p.width) / 2;
                  return (
                    <text x={x} y={Number(p.y) - 6} textAnchor="middle" fontSize={11} fill="#404040">
                      {buckets[i].homes.toLocaleString()}
                    </text>
                  );
                }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
