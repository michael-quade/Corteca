"use client";

import { useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { AlarmEntry } from "@/app/api/alarms/route";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrossRefGroup {
  displayMac: string;
  alarms: AlarmEntry[];
  reboots: Record<string, string>[];
  colorIdx: number;
}

// ── Color palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  { header: "bg-blue-100 border-blue-200",   alarm: "bg-blue-50",   reboot: "bg-sky-50"    },
  { header: "bg-violet-100 border-violet-200", alarm: "bg-violet-50", reboot: "bg-purple-50" },
  { header: "bg-amber-100 border-amber-200",  alarm: "bg-amber-50",  reboot: "bg-yellow-50" },
  { header: "bg-rose-100 border-rose-200",    alarm: "bg-rose-50",   reboot: "bg-pink-50"   },
  { header: "bg-teal-100 border-teal-200",    alarm: "bg-teal-50",   reboot: "bg-cyan-50"   },
  { header: "bg-orange-100 border-orange-200",alarm: "bg-orange-50", reboot: "bg-red-50"    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAC_RE = /^[0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}[:\-][0-9a-fA-F]{2}$/;
const MAC_COL_NAMES = ["home_wifi_id", "device_id", "ap_id", "mac", "mac_address"];

function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/[:\-\s]/g, "");
}

function findMacCol(rows: Record<string, string>[]): string | null {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  for (const name of MAC_COL_NAMES) {
    const col = cols.find((c) => c.toLowerCase() === name);
    if (col && rows.slice(0, 8).some((r) => MAC_RE.test((r[col] ?? "").trim()))) return col;
  }
  for (const col of cols) {
    const samples = rows.slice(0, 8).map((r) => r[col]).filter(Boolean);
    if (samples.length >= 2 && samples.every((v) => MAC_RE.test(v.trim()))) return col;
  }
  return null;
}

function fmtEpoch(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  major:    "bg-orange-100 text-orange-800 border-orange-200",
  minor:    "bg-amber-100 text-amber-800 border-amber-200",
  clear:    "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function SevBadge({ s }: { s: string }) {
  return (
    <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
      SEV_BADGE[s.toLowerCase()] ?? "bg-neutral-100 text-neutral-700 border-neutral-200")}>
      {s}
    </span>
  );
}

function buildGroups(alarms: AlarmEntry[], rebootRows: Record<string, string>[]): CrossRefGroup[] {
  const macCol = findMacCol(rebootRows);
  if (!macCol) return [];

  const rebootByNorm = new Map<string, Record<string, string>[]>();
  for (const row of rebootRows) {
    const norm = normalizeMac(row[macCol] ?? "");
    if (!norm) continue;
    if (!rebootByNorm.has(norm)) rebootByNorm.set(norm, []);
    rebootByNorm.get(norm)!.push(row);
  }

  const alarmsByNorm = new Map<string, AlarmEntry[]>();
  for (const alarm of alarms) {
    if (!alarm.ap) continue;
    const norm = normalizeMac(alarm.ap);
    if (!alarmsByNorm.has(norm)) alarmsByNorm.set(norm, []);
    alarmsByNorm.get(norm)!.push(alarm);
  }

  const groups: CrossRefGroup[] = [];
  let idx = 0;
  for (const [norm, alarmList] of alarmsByNorm) {
    const reboots = rebootByNorm.get(norm);
    if (reboots?.length) {
      groups.push({
        displayMac: alarmList[0].ap ?? norm,
        alarms: alarmList,
        reboots,
        colorIdx: idx++ % PALETTE.length,
      });
    }
  }
  return groups.sort((a, b) => b.alarms.length - a.alarms.length);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  alarms: AlarmEntry[];
  rebootRows: Record<string, string>[];
}

export function AlarmCrossRefTable({ alarms, rebootRows }: Props) {
  const groups = useMemo(() => buildGroups(alarms, rebootRows), [alarms, rebootRows]);
  const rebootCols = useMemo(() => Object.keys(rebootRows[0] ?? {}), [rebootRows]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-neutral-700">No cross-matches found</p>
        <p className="mt-1 text-xs text-neutral-400">
          None of the {alarms.filter((a) => a.ap).length} alarm AP MACs appear in the reboot report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        {groups.length} AP{groups.length !== 1 ? "s" : ""} found in both alarm results and the reboot report
        — {groups.reduce((n, g) => n + g.reboots.length, 0)} total reboot event{groups.reduce((n, g) => n + g.reboots.length, 0) !== 1 ? "s" : ""} matched.
      </p>

      {groups.map((group) => {
        const c = PALETTE[group.colorIdx];
        return (
          <div key={group.displayMac} className={cn("overflow-hidden rounded-xl border shadow-sm", c.header.split(" ")[1])}>

            {/* Group header */}
            <div className={cn("flex flex-wrap items-center gap-3 px-4 py-3", c.header)}>
              <span className="font-mono text-sm font-bold text-neutral-800">{group.displayMac}</span>
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                {group.alarms.length} alarm{group.alarms.length !== 1 ? "s" : ""}
              </span>
              <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                {group.reboots.length} reboot{group.reboots.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Alarm rows */}
            <div className="border-t border-neutral-200">
              <div className={cn("px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400", c.alarm)}>
                Alarms
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full">
                  <thead>
                    <tr className="bg-white/60">
                      {["Created", "Severity", "Category", "Message", "Model", "Customer ID"].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.alarms.map((alarm, i) => (
                      <tr key={i} className={cn("border-t border-white/60", c.alarm)}>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">{fmtEpoch(alarm.createdTime)}</td>
                        <td className="px-3 py-2"><SevBadge s={alarm.severity ?? "—"} /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-neutral-700">{alarm.category ?? "—"}</td>
                        <td className="max-w-[260px] px-3 py-2 text-xs text-neutral-600"><span className="line-clamp-1">{alarm.message ?? "—"}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-600">{alarm.model ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-500">{alarm.customerId ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reboot rows */}
            <div className="border-t border-neutral-200">
              <div className={cn("px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400", c.reboot)}>
                Reboot Events
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-max w-full">
                  <thead>
                    <tr className="bg-white/60">
                      {rebootCols.map((col) => (
                        <th key={col} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                          {col.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.reboots.map((row, i) => (
                      <tr key={i} className={cn("border-t border-white/60", c.reboot)}>
                        {rebootCols.map((col) => (
                          <td key={col} className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">
                            {row[col] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
