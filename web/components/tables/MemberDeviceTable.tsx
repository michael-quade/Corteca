"use client";

import { Fragment, useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import { wifiLabel } from "@/web/lib/memberConnection";
import { FilterPopover } from "./NetworkMembersTableParts";
import { MEMBER_COLUMNS, type ColumnCtx, type ColumnKey, type ConnectionOf } from "./memberColumns";

export type { ConnectionOf } from "./memberColumns";
export type SortKey = ColumnKey;
export type SortDir = "asc" | "desc";
export type Filters = Partial<Record<ColumnKey, string>>;
export const EMPTY_FILTERS: Filters = {};

/** Without network context (Device Search): WiFi details, or just "Wired". */
const basicConnection: ConnectionOf = (m) => ({
  link: wifiLabel(m) || (String(m.type ?? "").toLowerCase() === "ethernet" ? "Wired" : ""),
  ap: null,
});

interface Props {
  members: Member[];
  /** History tab: adds Last seen, drops live-only columns, and the AP column reads "Last AP". */
  history?: boolean;
  /** Given (MCP visualizer): wired port / switch in Connection, AP name + model + MAC in Connected AP. */
  connection?: ConnectionOf;
  identity: ColumnCtx["identity"];
  /** Pickable columns to show (Device and, in history, Last seen always show). */
  visible: ColumnKey[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filters: Filters;
  setFilters: (fn: (f: Filters) => Filters) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  empty: string;
}

export function MemberDeviceTable(props: Props) {
  const { members, history, connection, identity, visible, selectedId, onSelect, filters, setFilters, sortKey, sortDir, onSort, empty } = props;
  const ctx: ColumnCtx = useMemo(
    () => ({ connection: connection ?? basicConnection, richAp: !!connection, identity }),
    [connection, identity],
  );
  const columns = useMemo(() => MEMBER_COLUMNS.filter((c) =>
    (c.pickable ? visible.includes(c.key) : true)
    && !(c.historyOnly && !history)
    && !(c.connectedOnly && history),
  ), [visible, history]);

  const rows = useMemo(() => {
    let result = [...members];
    for (const col of columns) {
      const term = (filters[col.key] ?? "").trim().toLowerCase();
      if (term) result = result.filter((m) => String((col.text ?? col.value)(m, ctx)).toLowerCase().includes(term));
    }
    const sortCol = MEMBER_COLUMNS.find((c) => c.key === sortKey) ?? MEMBER_COLUMNS[0];
    result.sort((a, b) => {
      const va = sortCol.value(a, ctx), vb = sortCol.value(b, ctx);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [members, filters, sortKey, sortDir, columns, ctx]);

  const label = (key: ColumnKey, l: string) => (key === "device_id" && history ? "Last AP" : l);

  return (
    <div className="max-h-[60vh] overflow-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-neutral-100 shadow-[0_1px_0_0_#e5e7eb]">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-neutral-700 hover:text-neutral-800"
                  >
                    {label(col.key, col.label)}
                    <span className={cn("text-xs", sortKey === col.key ? "text-neutral-700" : "text-neutral-300")}>
                      {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                  <FilterPopover
                    value={filters[col.key] ?? ""}
                    onChange={(v) => setFilters((f) => ({ ...f, [col.key]: v }))}
                    active={!!filters[col.key]}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="bg-white px-4 py-6 text-center text-sm text-neutral-400">
                {members.length === 0 ? empty : "No devices match the current filters."}
              </td>
            </tr>
          ) : (
            rows.map((m) => (
              <tr
                key={m.id}
                onClick={onSelect ? () => onSelect(m.id) : undefined}
                data-selected={selectedId === m.id || undefined}
                className={cn(
                  "transition-colors",
                  selectedId === m.id ? "bg-violet-50 hover:bg-violet-100" : "bg-white hover:bg-neutral-50",
                  onSelect && "cursor-pointer"
                )}
              >
                {columns.map((col) => <Fragment key={col.key}>{col.cell(m, ctx)}</Fragment>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
