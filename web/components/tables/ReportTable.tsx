"use client";

import { useState, useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { ReportRow } from "@/web/components/ReportChart";

type SortDir = "asc" | "desc";

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function isTimestampCol(col: string): boolean {
  const lc = col.toLowerCase();
  return ["time", "date", "at", "stamp"].some((s) => lc.includes(s));
}

function displayCell(col: string, val: unknown): string {
  const s = toStr(val);
  if (!s) return "—";
  if (isTimestampCol(col)) {
    try { return new Date(s).toLocaleString(); } catch { /* fall through */ }
  }
  return s;
}

interface ReportTableProps {
  rows: ReportRow[];
  columns: string[];
}

export function ReportTable({ rows, columns }: ReportTableProps) {
  const [sortCol, setSortCol] = useState<string>(columns[0] ?? "");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filters, setFilters] = useState<Record<string, string>>({});

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  }

  const displayed = useMemo(() => {
    let result = [...rows];
    for (const col of columns) {
      const term = (filters[col] ?? "").trim().toLowerCase();
      if (term) result = result.filter((r) => toStr(r[col]).toLowerCase().includes(term));
    }
    result.sort((a, b) => {
      const cmp = toStr(a[sortCol]).localeCompare(toStr(b[sortCol]));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [rows, columns, filters, sortCol, sortDir]);

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-500">No records in this report.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <span className="text-xs font-medium text-neutral-500">
          {displayed.length} of {rows.length} record{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {columns.map((col) => (
                <th key={col} className="px-4 py-3 text-left">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className="flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-800"
                    >
                      {col.replace(/_/g, " ")}
                      <span className={cn("text-xs", sortCol === col ? "text-neutral-700" : "text-neutral-300")}>
                        {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>
                    </button>
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={filters[col] ?? ""}
                      onChange={(e) => setFilters((f) => ({ ...f, [col]: e.target.value }))}
                      className="w-full min-w-[80px] rounded border border-neutral-200 px-2 py-1 text-xs text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-neutral-400">
                  No records match the current filters.
                </td>
              </tr>
            ) : (
              displayed.map((row, i) => (
                <tr key={i} className="bg-white transition-colors hover:bg-neutral-50">
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-4 py-3 font-mono text-xs text-neutral-600">
                      {displayCell(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
