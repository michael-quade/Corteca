"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AgeBucket } from "@/web/lib/fleet/inventory";
import { fmtInt, pctOf } from "@/web/lib/fleet/labels";

function AgeTip({ active, payload, total }: { active?: boolean; payload?: { payload: AgeBucket }[]; total: number }) {
  const b = payload?.[0]?.payload;
  if (!active || !b) return null;
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200">
      <p className="font-semibold text-neutral-900">Last seen {b.label === "No time" ? "— no time recorded" : `${b.label} ago`}</p>
      <p className="text-neutral-700">{fmtInt(b.count)} WiFi points · {pctOf(b.count, total)} of offline</p>
    </div>
  );
}

/** Offline WiFi points by how long ago they were last online; count on each bar. */
export function OfflineAgeChart({ buckets }: { buckets: AgeBucket[] }) {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  return (
    <div className="h-[260px] w-full [&_svg:focus]:outline-none [&_svg_*:focus]:outline-none">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 22, right: 8, bottom: 4, left: 0 }} barCategoryGap="24%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="#eef0f3" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d4d4d4" }} tick={{ fontSize: 12, fill: "#525252" }} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#737373" }} width={44} allowDecimals={false} />
          <Tooltip content={<AgeTip total={total} />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
          <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="top" fontSize={11} fill="#404040" formatter={(v: unknown) => fmtInt(Number(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
