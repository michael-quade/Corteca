"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { PeriodBucket } from "@/web/lib/sessionHistory";

function fmtB(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

const tick  = { fontSize: 11, fill: "#6b7280" };
const grid  = { strokeDasharray: "3 3", stroke: "#f3f4f6" };
const axisL = { tickLine: false, axisLine: false };

interface Props { buckets: PeriodBucket[] }

export function UsageChart({ buckets }: Props) {
  if (buckets.length === 0) return (
    <div className="rounded-xl border border-neutral-200 bg-white px-6 py-16 text-center text-sm text-neutral-400">
      No data for the selected period.
    </div>
  );

  const data = buckets.map((b) => ({
    label:          b.label,
    "Auth Events":  b.authEvents,
    "API Calls":    b.calls,
    Throttled:      b.rateLimitHits,
    Sent:           b.bytesSent,
    Received:       b.bytesReceived,
  }));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Auth Events &amp; API Calls</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="label" tick={tick} {...axisL} />
            <YAxis tick={tick} {...axisL} width={36} allowDecimals={false} />
            <Tooltip wrapperStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Auth Events" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="API Calls"   fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Throttled"   fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Data Transfer (bytes)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="label" tick={tick} {...axisL} />
            <YAxis tickFormatter={fmtB} tick={tick} {...axisL} width={46} />
            <Tooltip formatter={(v) => typeof v === 'number' ? `${fmtB(v)} B` : v} wrapperStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Sent"     fill="#f97316" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Received" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
