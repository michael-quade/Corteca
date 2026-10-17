"use client";

import { CARD } from "@/web/components/corteca/styles";
import { cn } from "@/web/lib/utils";
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
    <div className={cn(CARD, "overflow-hidden")}>
      <div className="flex items-baseline justify-between px-5 py-4">
        <h2 className="text-lg font-semibold text-neutral-900">Session history</h2>
        <span className="text-xs text-neutral-500">{sessions.length} total sessions recorded</span>
      </div>
      <div className="max-h-[60vh] overflow-auto border-t border-neutral-200">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-neutral-100 text-left text-xs font-semibold text-neutral-700 shadow-[0_1px_0_0_#e5e7eb]">
              {["Started", "Duration", "API Calls", "Bytes Sent", "Bytes Received", "Throttled", "Status"].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 bg-white last:border-0 hover:bg-neutral-50">
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
