"use client";

import type { SessionRecord } from "@/web/lib/sessionHistory";

function fmtBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)} KB`;
  return `${n} B`;
}

function fmtDuration(start: number, end: number | null): string {
  const ms = (end ?? Date.now()) - start;
  const s  = Math.floor(ms / 1000);
  if (s < 60)  return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface Props { sessions: SessionRecord[] }

export function SessionTable({ sessions }: Props) {
  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime).slice(0, 100);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-neutral-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-neutral-700">Session History</h2>
        <span className="text-xs text-neutral-400">{sessions.length} total sessions recorded</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs font-medium text-neutral-500">
              {["Started", "Duration", "API Calls", "Bytes Sent", "Bytes Received", "Throttled", "Status"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50/60">
                <td className="whitespace-nowrap px-4 py-3 text-neutral-900">
                  {new Date(s.startTime).toLocaleString()}
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-600">{fmtDuration(s.startTime, s.endTime)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-neutral-900">{s.calls.toLocaleString()}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-orange-600">{fmtBytes(s.bytesSent)}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-emerald-600">{fmtBytes(s.bytesReceived)}</td>
                <td className="px-4 py-3">
                  {s.rateLimitHits > 0
                    ? <span className="font-medium text-amber-500">{s.rateLimitHits}</span>
                    : <span className="text-neutral-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {!s.endTime
                    ? <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />Active</span>
                    : <span className="text-xs text-neutral-400">Ended</span>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-neutral-400">No sessions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
