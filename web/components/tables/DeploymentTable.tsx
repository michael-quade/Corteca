"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/web/lib/utils";
import { ColumnFilter } from "./ColumnFilter";

interface Props { rows: Record<string, string>[]; headers: string[]; pinnedFirst?: string[] }

type SortDir = "asc" | "desc";
const PAGE_SIZES = [50, 100, 250] as const;

function FunnelIcon({ active }: { active: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor" className={cn("shrink-0 transition-colors", active ? "text-blue-600" : "text-neutral-300 group-hover:text-neutral-500")}>
      <path fillRule="evenodd" d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 .8 1.6L13 10.5V16a1 1 0 0 1-1.45.89l-2-1A1 1 0 0 1 9 15v-4.5L3.2 4.6A1 1 0 0 1 3 4z" clipRule="evenodd"/>
    </svg>
  );
}

export function DeploymentTable({ rows, headers, pinnedFirst = ["Account Name", "Customer Name", "Subscriber Name", "Customer ID"] }: Props) {
  const [sortCol, setSortCol]         = useState<string | null>(null);
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [filters, setFilters]         = useState<Record<string, Set<string> | null>>({});
  const [openFilter, setOpenFilter]   = useState<string | null>(null);
  const [filterPos, setFilterPos]     = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [filterSearch, setFilterSearch] = useState("");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<typeof PAGE_SIZES[number]>(100);

  const pinnedCol = useMemo(() =>
    (Array.isArray(pinnedFirst) ? pinnedFirst : [pinnedFirst]).find((p) => headers.includes(p)) ?? null,
  [headers, pinnedFirst]);

  const orderedHeaders = useMemo(() => {
    if (!pinnedCol) return headers;
    return [pinnedCol, ...headers.filter((h) => h !== pinnedCol)];
  }, [headers, pinnedCol]);

  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const h of orderedHeaders) {
      const vals = [...new Set(rows.map((r) => r[h] ?? ""))].sort();
      map[h] = vals;
    }
    return map;
  }, [rows, orderedHeaders]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      for (const [col, sel] of Object.entries(filters)) {
        if (!sel) continue; // null = no filter
        if (!sel.has(row[col] ?? "")) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const av = a[sortCol] ?? "", bv = b[sortCol] ?? "";
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const visibleRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  const activeFilterCount = Object.values(filters).filter((v) => v !== null && v !== undefined).length;

  const handleSort = useCallback((col: string) => {
    setSortCol((prev) => {
      if (prev === col) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return col; }
      setSortDir("asc"); return col;
    });
    setPage(1);
  }, []);

  const handleFilterOpen = useCallback((col: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openFilter === col) { setOpenFilter(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setFilterPos({ top: rect.bottom, left: rect.left });
    setFilterSearch("");
    setOpenFilter(col);
  }, [openFilter]);

  const handleFilterChange = useCallback((col: string, val: Set<string> | null) => {
    setFilters((prev) => {
      if (val === null) { const n = { ...prev }; delete n[col]; return n; }
      return { ...prev, [col]: val };
    });
    setPage(1);
  }, []);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} rows
          {activeFilterCount > 0 && (
            <button type="button" onClick={() => { setFilters({}); setPage(1); }} className="ml-2 font-medium text-blue-600 hover:underline">
              Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            </button>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          {PAGE_SIZES.map((s) => (
            <button key={s} type="button" onClick={() => { setPageSize(s); setPage(1); }} className={cn("rounded px-2 py-0.5 font-medium", pageSize === s ? "bg-blue-100 text-blue-700" : "hover:bg-neutral-100")}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full min-w-max border-collapse text-xs">
          <thead className="sticky top-0 z-20 bg-neutral-50">
            <tr>
              {orderedHeaders.map((col) => {
                const active = Boolean(filters[col]);
                const isPin  = col === pinnedCol;
                return (
                  <th key={col} className={cn("group border-b border-neutral-200 px-3 py-2 text-left font-semibold text-neutral-700 whitespace-nowrap", isPin && "sticky left-0 z-10 bg-neutral-50 shadow-[1px_0_0_#e5e7eb]")}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleSort(col)} className="hover:text-blue-700 flex items-center gap-0.5">
                        {col}
                        {sortCol === col && <span className="text-blue-600">{sortDir === "asc" ? " ↑" : " ↓"}</span>}
                      </button>
                      <button type="button" data-filter-button onClick={(e) => handleFilterOpen(col, e)} className="ml-0.5">
                        <FunnelIcon active={active} />
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visibleRows.map((row, i) => (
              <tr key={i} className="hover:bg-neutral-50">
                {orderedHeaders.map((col) => {
                  const isPin = col === pinnedCol;
                  return (
                    <td key={col} className={cn("max-w-[200px] truncate px-3 py-1.5 text-neutral-700", isPin && "sticky left-0 z-10 bg-white shadow-[1px_0_0_#e5e7eb] font-medium")} title={row[col]}>{row[col] || "—"}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setPage(1)} disabled={page === 1} className="rounded border border-neutral-200 px-2 py-0.5 disabled:opacity-40 hover:bg-neutral-50">«</button>
          <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-neutral-200 px-2 py-0.5 disabled:opacity-40 hover:bg-neutral-50">‹ Prev</button>
          <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded border border-neutral-200 px-2 py-0.5 disabled:opacity-40 hover:bg-neutral-50">Next ›</button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} className="rounded border border-neutral-200 px-2 py-0.5 disabled:opacity-40 hover:bg-neutral-50">»</button>
        </div>
      </div>

      {/* Filter dropdown (shared, positioned fixed) */}
      {openFilter && (
        <ColumnFilter
          column={openFilter}
          uniqueValues={uniqueValues[openFilter] ?? []}
          activeFilter={filters[openFilter] ?? null}
          searchText={filterSearch}
          onSearchChange={setFilterSearch}
          onChange={(val) => handleFilterChange(openFilter, val)}
          onClose={() => setOpenFilter(null)}
          position={filterPos}
        />
      )}
    </div>
  );
}
