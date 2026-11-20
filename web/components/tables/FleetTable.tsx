"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import { TABLE_HEAD_ROW } from "@/web/components/corteca/styles";

export interface FleetColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  render: (r: T) => ReactNode;
  /** Sort value; columns without one don't sort. */
  sort?: (r: T) => number | string;
}

/**
 * Fleet Metrics table: sticky header, click a header to sort (numbers start high-first),
 * optional tint for flagged rows and a cap on rows drawn ("Showing 200 of 5,000").
 */
export function FleetTable<T>({ rows, columns, rowKey, tinted, maxHeight = "max-h-[60vh]", limit = 500, empty = "Nothing to show." }: {
  rows: T[];
  columns: FleetColumn<T>[];
  rowKey: (r: T, i: number) => string;
  tinted?: (r: T) => boolean;
  maxHeight?: string;
  limit?: number;
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null);

  const sorted = useMemo(() => {
    const by = sort && columns.find((c) => c.key === sort.key)?.sort;
    if (!sort || !by) return rows;
    return [...rows].sort((a, b) => {
      const x = by(a), y = by(b);
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.desc ? -d : d;
    });
  }, [rows, columns, sort]);

  if (!rows.length) return <p className="py-4 text-sm text-neutral-500">{empty}</p>;
  const shown = sorted.slice(0, limit);

  return (
    <div className="space-y-1">
      <div className={cn("overflow-auto rounded-xl ring-1 ring-neutral-200", maxHeight)}>
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0 z-10">
            <tr className={TABLE_HEAD_ROW}>
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2 text-xs font-semibold text-neutral-700", c.numeric ? "text-right" : "text-left")}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : !!c.numeric }))}
                      className="inline-flex items-center gap-1 hover:text-blue-700"
                    >
                      {c.label}
                      {sort?.key === c.key && <span aria-hidden>{sort.desc ? "↓" : "↑"}</span>}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={rowKey(r, i)} className={cn("border-t border-neutral-100 hover:bg-neutral-50", tinted?.(r) ? "bg-yellow-50/60" : "bg-white")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-1.5 text-neutral-800", c.numeric && "text-right tabular-nums")}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && <p className="text-xs text-neutral-500">Showing {shown.length.toLocaleString()} of {rows.length.toLocaleString()} rows.</p>}
    </div>
  );
}
