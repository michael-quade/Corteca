"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { AlarmEntry } from "@/app/api/alarms/route";

const CONSOLE_BASE =
  process.env.NEXT_PUBLIC_CORTECA_CONSOLE_URL ?? "https://console.demo2.homewifi.nokia.com";

function consoleUrl(mac: string): string {
  return `${CONSOLE_BASE}/home-troubleshooting/dashboard?mac=${mac.toUpperCase().replace(/:/g, "-")}`;
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  major:    "bg-orange-100 text-orange-800 border-orange-200",
  minor:    "bg-amber-100 text-amber-800 border-amber-200",
  clear:    "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function SeverityBadge({ severity }: { severity: string }) {
  const key = severity.toLowerCase();
  return (
    <span className={cn(
      "inline-block rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
      SEVERITY_BADGE[key] ?? "bg-neutral-100 text-neutral-700 border-neutral-200",
    )}>
      {severity}
    </span>
  );
}

function fmtEpoch(ms: number | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

function ConsoleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7"/>
      <path d="M8 1h3v3M11 1 6 6"/>
    </svg>
  );
}

type SortCol = "created" | "ap" | "severity" | "category" | "model" | "customer";
type SortDir = "asc" | "desc";

function sortKey(alarm: AlarmEntry, col: SortCol): string | number {
  switch (col) {
    case "created":  return alarm.createdTime ?? 0;
    case "ap":       return alarm.ap ?? "";
    case "severity": return alarm.severity?.toLowerCase() ?? "";
    case "category": return alarm.category ?? "";
    case "model":    return alarm.model ?? "";
    case "customer": return alarm.customerId ?? "";
  }
}

interface Props {
  alarms: AlarmEntry[];
  severityFilter?: Set<string>;
}

export function AlarmTable({ alarms, severityFilter }: Props) {
  const [sortCol, setSortCol] = useState<SortCol>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<number | null>(null);

  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "created" ? "desc" : "asc"); }
  }

  const filtered = useMemo(() => {
    if (!severityFilter || severityFilter.size === 0) return alarms;
    return alarms.filter((a) => severityFilter.has((a.severity ?? "").toLowerCase()));
  }, [alarms, severityFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = sortKey(a, sortCol);
      const bv = sortKey(b, sortCol);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  function Th({ col, label, className }: { col: SortCol; label: string; className?: string }) {
    const active = sortCol === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={cn(
          "cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 hover:text-neutral-900",
          className,
        )}
      >
        {label}{active && <span className="ml-1 text-neutral-400">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  if (alarms.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-neutral-400">
        No alarms found for the selected parameters.
      </div>
    );
  }

  const hiddenCount = alarms.length - sorted.length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        {sorted.length} of {alarms.length} alarm{alarms.length !== 1 ? "s" : ""}
        {hiddenCount > 0 && <span className="ml-1 text-neutral-400">({hiddenCount} filtered out)</span>}
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="bg-neutral-100 shadow-[0_1px_0_0_#e5e7eb]">
              <Th col="created"  label="Created" />
              <Th col="ap"       label="AP MAC" />
              <Th col="severity" label="Severity" />
              <Th col="category" label="Category" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">Message</th>
              <Th col="model"    label="Model" />
              <Th col="customer" label="Customer ID" />
              <th className="w-16 px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">Console</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((alarm, i) => {
              const isOpen = expanded === i;
              return (
                <React.Fragment key={i}>
                  <tr className={cn(
                    "border-t border-neutral-100 transition-colors",
                    isOpen ? "bg-blue-50" : "bg-white hover:bg-neutral-50",
                  )}>
                    {/* Created time */}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">
                      {fmtEpoch(alarm.createdTime)}
                    </td>

                    {/* AP MAC */}
                    <td className="px-3 py-2">
                      {alarm.ap ? (
                        <span className="font-mono text-xs text-neutral-800">{alarm.ap}</span>
                      ) : (
                        <span className="font-mono text-xs text-neutral-400">—</span>
                      )}
                    </td>

                    {/* Severity */}
                    <td className="px-3 py-2">
                      <SeverityBadge severity={alarm.severity ?? "—"} />
                    </td>

                    {/* Category */}
                    <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-neutral-700">
                      {alarm.category ?? "—"}
                    </td>

                    {/* Message — truncated */}
                    <td className="max-w-[280px] px-3 py-2 text-xs text-neutral-600">
                      <span className="line-clamp-2">{alarm.message ?? "—"}</span>
                    </td>

                    {/* Model */}
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-neutral-600">
                      {alarm.model ?? "—"}
                    </td>

                    {/* Customer ID */}
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-neutral-600">
                      {alarm.customerId ?? <span className="text-neutral-300">—</span>}
                    </td>

                    {/* Console launch */}
                    <td className="px-3 py-2">
                      {alarm.ap ? (
                        <button
                          type="button"
                          onClick={() => window.open(consoleUrl(alarm.ap!), "_blank", "noopener,noreferrer")}
                          className="inline-flex items-center gap-1.5 rounded border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          title="Open in Corteca Console"
                        >
                          <ConsoleIcon />
                          Open
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-300">—</span>
                      )}
                    </td>

                    {/* Expand toggle */}
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : i)}
                        className="text-neutral-400 transition-colors hover:text-neutral-700"
                        title={isOpen ? "Collapse" : "Expand"}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={cn("transition-transform", isOpen ? "rotate-180" : "")}>
                          <path d="M4 6l4 4 4-4"/>
                        </svg>
                      </button>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isOpen && (
                    <tr className="border-t border-blue-100 bg-blue-50">
                      <td colSpan={9} className="px-4 py-3">
                        <dl className="grid grid-cols-2 gap-x-8 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                          <div>
                            <dt className="text-xs font-medium text-neutral-500">Serial Number</dt>
                            <dd className="font-mono text-xs text-neutral-800">{alarm.sn ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-neutral-500">Entity</dt>
                            <dd className="font-mono text-xs text-neutral-800">{alarm.entity ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-neutral-500">Tenant</dt>
                            <dd className="font-mono text-xs text-neutral-800">{alarm.tenantId ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-neutral-500">Last Updated</dt>
                            <dd className="font-mono text-xs text-neutral-800">{fmtEpoch(alarm.updatedTime)}</dd>
                          </div>
                          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
                            <dt className="text-xs font-medium text-neutral-500">Full Message</dt>
                            <dd className="mt-0.5 text-xs text-neutral-700">{alarm.message ?? "—"}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
