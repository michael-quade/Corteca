"use client";

import { useMemo } from "react";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import { wifiLabel, type ConnectedAp, type MemberConnection } from "@/web/lib/memberConnection";
import { ConnectedApCell, DeviceCell, FilterPopover, LastSeenCell } from "./NetworkMembersTableParts";

export type SortKey = "alias" | "wifi" | "device_id" | "ipv4" | "last_seen";
export type SortDir = "asc" | "desc";
export type ConnectionOf = (m: Member) => MemberConnection;
export const EMPTY_FILTERS: Record<SortKey, string> = { alias: "", wifi: "", device_id: "", ipv4: "", last_seen: "" };

/** Without network context (Device Search): WiFi details, or just "Wired". */
const basicConnection: ConnectionOf = (m) => ({
  link: wifiLabel(m) || (String(m.type ?? "").toLowerCase() === "ethernet" ? "Wired" : ""),
  ap: null,
});

const apText = (ap: ConnectedAp | null) => (ap ? [ap.name, ap.model, ap.gateway && "gateway", ap.mac].filter(Boolean).join(" ") : "");

function getValue(m: Member, key: SortKey, connection: ConnectionOf): string {
  switch (key) {
    case "alias":     return `${m.alias ?? m.id}${m.paused ? " paused" : ""}`.toLowerCase();
    case "wifi":      return connection(m).link.toLowerCase();
    case "ipv4":      return m.ipv4 ?? "";
    case "device_id": return apText(connection(m).ap).toLowerCase() || (m.device_id ?? "");
    case "last_seen": return m.last_seen ?? "";
  }
}

interface Props {
  members: Member[];
  /** History tab: adds Last seen, and the AP column reads "Last AP". */
  history?: boolean;
  /** Given (MCP visualizer): wired port / switch in Connection, AP name + model + MAC in Connected AP. */
  connection?: ConnectionOf;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filters: Record<SortKey, string>;
  setFilters: (fn: (f: Record<SortKey, string>) => Record<SortKey, string>) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  empty: string;
}

export function MemberDeviceTable({ members, history, connection, selectedId, onSelect, filters, setFilters, sortKey, sortDir, onSort, empty }: Props) {
  const connectionOf = connection ?? basicConnection;
  const columns = useMemo(() => [
    { key: "alias" as const, label: "Device" },
    { key: "wifi" as const, label: "Connection" },
    { key: "device_id" as const, label: history ? "Last AP" : "Connected AP" },
    { key: "ipv4" as const, label: "IP" },
    ...(history ? [{ key: "last_seen" as const, label: "Last seen" }] : []),
  ], [history]);

  const rows = useMemo(() => {
    let result = [...members];
    for (const col of columns) {
      const term = filters[col.key].trim().toLowerCase();
      if (term) result = result.filter((m) => getValue(m, col.key, connectionOf).includes(term));
    }
    result.sort((a, b) => {
      const cmp = getValue(a, sortKey, connectionOf).localeCompare(getValue(b, sortKey, connectionOf));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [members, filters, sortKey, sortDir, columns, connectionOf]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-neutral-100 shadow-[0_1px_0_0_#e5e7eb]">
          {columns.map((col) => (
            <th key={col.key} className="px-4 py-3 text-left">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className="flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-800"
                >
                  {col.label}
                  <span className={cn("text-xs", sortKey === col.key ? "text-neutral-700" : "text-neutral-300")}>
                    {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                  </span>
                </button>
                <FilterPopover
                  value={filters[col.key]}
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
            <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-neutral-400">
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
              <DeviceCell m={m} />
              <td className="px-4 py-3 text-neutral-700">{connectionOf(m).link || "—"}</td>
              {connection
                ? <ConnectedApCell ap={connectionOf(m).ap} />
                : <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.device_id ?? "—"}</td>}
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.ipv4 ?? "—"}</td>
              {history && <LastSeenCell m={m} />}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
