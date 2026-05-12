"use client";

import { useState, useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { NetworkSwEntry } from "@/web/components/SwOverview.types";

type SortDir = "asc" | "desc";

const COLUMNS = [
  "Account Name",
  "MAC",
  "Online",
  "Release",
  "Beacon Model",
  "Firmware",
  "Device Model",
  "Customer ID",
] as const;

type Col = (typeof COLUMNS)[number];

interface SwNetworkTableProps {
  entries: NetworkSwEntry[];
  accountNames: Map<string, string>;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "Online" : "Offline";
  return String(v);
}

function getVal(entry: NetworkSwEntry, accountNames: Map<string, string>, col: Col): string {
  switch (col) {
    case "Account Name": return accountNames.get(entry.mac.toUpperCase().replace(/:/g, '-')) ?? accountNames.get(entry.mac) ?? "";
    case "MAC":          return entry.mac;
    case "Online":       return entry.online ? "Online" : "Offline";
    case "Release":      return entry.releaseName ?? "";
    case "Beacon Model": return entry.beaconModel ?? "";
    case "Firmware":     return entry.firmware;
    case "Device Model": return entry.deviceModel;
    case "Customer ID":  return entry.customerId;
  }
}

export function SwNetworkTable({ entries, accountNames }: SwNetworkTableProps) {
  const [sortCol, setSortCol] = useState<Col>("Release");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Partial<Record<Col, string>>>({});

  function handleSort(col: Col) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const displayed = useMemo(() => {
    let result = [...entries];
    for (const col of COLUMNS) {
      const term = (filters[col] ?? "").trim().toLowerCase();
      if (term) {
        result = result.filter((e) =>
          getVal(e, accountNames, col).toLowerCase().includes(term),
        );
      }
    }
    result.sort((a, b) => {
      const av = getVal(a, accountNames, sortCol);
      const bv = getVal(b, accountNames, sortCol);
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return result;
  }, [entries, accountNames, filters, sortCol, sortDir]);

  if (entries.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No records found.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-500">
          {displayed.length} of {entries.length} record{entries.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {COLUMNS.map((col) => (
                <th key={col} className="px-4 py-3 text-left">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-800"
                    >
                      {col}
                      <span className={cn("text-xs", sortCol === col ? "text-neutral-700" : "text-neutral-300")}>
                        {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={filters[col] ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, [col]: e.target.value }))}
                      className="w-full min-w-[72px] rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              displayed.map((entry, i) => (
                <tr key={i} className="bg-white transition-colors hover:bg-neutral-50">
                  {COLUMNS.map((col) => {
                    const val = getVal(entry, accountNames, col);
                    if (col === "Online") {
                      return (
                        <td key={col} className="whitespace-nowrap px-4 py-3 text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                entry.online ? "bg-emerald-500" : "bg-neutral-400",
                              )}
                            />
                            <span className={entry.online ? "text-emerald-700" : "text-neutral-500"}>
                              {val}
                            </span>
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td
                        key={col}
                        className={cn(
                          "whitespace-nowrap px-4 py-3 text-xs",
                          col === "Account Name"
                            ? "font-medium text-neutral-800"
                            : "font-mono text-neutral-600",
                        )}
                      >
                        {val || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
