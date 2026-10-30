"use client";

import { useState, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import { FilterPopover, StatusBadge } from "./NetworkMembersTableParts";
import { wifiLabel, type ConnectedAp, type MemberConnection } from "@/web/lib/memberConnection";

type SortKey = "alias" | "status" | "wifi" | "ipv4" | "device_id";
type SortDir = "asc" | "desc";
type TabId = "connected" | "not-connected";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "alias",     label: "Device" },
  { key: "status",    label: "Status" },
  { key: "wifi",      label: "Connection" },
  { key: "ipv4",      label: "IP" },
  { key: "device_id", label: "Connected AP" },
];

type ConnectionOf = (m: Member) => MemberConnection;

/** Without network context (Device Search): WiFi details, or just "Wired". */
const basicConnection: ConnectionOf = (m) => ({
  link: wifiLabel(m) || (String(m.type ?? "").toLowerCase() === "ethernet" ? "Wired" : ""),
  ap: null,
});

const apText = (ap: ConnectedAp | null) => (ap ? [ap.name, ap.model, ap.gateway && "gateway", ap.mac].filter(Boolean).join(" ") : "");

function statusLabel(m: Member) {
  if (m.paused) return "paused";
  return m.connected ? "connected" : "offline";
}

function statusOrder(m: Member) {
  if (m.paused) return 1;
  return m.connected ? 2 : 0;
}

function getValue(m: Member, key: SortKey, connection: ConnectionOf): string {
  switch (key) {
    case "alias":     return (m.alias ?? m.id).toLowerCase();
    case "status":    return statusLabel(m);
    case "wifi":      return connection(m).link.toLowerCase();
    case "ipv4":      return m.ipv4 ?? "";
    case "device_id": return apText(connection(m).ap).toLowerCase() || (m.device_id ?? "");
  }
}

function DeviceTable({ members, filters, setFilters, sortKey, sortDir, onSort, selectedId, onSelect, connection }: {
  members: Member[];
  /** Given (MCP visualizer): wired port / switch in Connection, AP name + model + MAC in Connected AP. */
  connection?: ConnectionOf;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  filters: Record<SortKey, string>;
  setFilters: (fn: (f: Record<SortKey, string>) => Record<SortKey, string>) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const connectionOf = connection ?? basicConnection;
  const columns = COLUMNS;
  const rows = useMemo(() => {
    let result = [...members];
    for (const col of columns) {
      const term = filters[col.key].trim().toLowerCase();
      if (term) result = result.filter((m) => getValue(m, col.key, connectionOf).includes(term));
    }
    result.sort((a, b) => {
      const av = sortKey === "status" ? statusOrder(a) : getValue(a, sortKey, connectionOf);
      const bv = sortKey === "status" ? statusOrder(b) : getValue(b, sortKey, connectionOf);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
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
              No devices match the current filters.
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
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">{m.alias ?? "—"}</p>
                <p className="mt-0.5 font-mono text-xs text-neutral-400">{m.id}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge connected={m.connected} paused={m.paused} />
              </td>
              <td className="px-4 py-3 text-neutral-700">{connectionOf(m).link || "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.ipv4 ?? "—"}</td>
              {connection
                ? <ConnectedApCell ap={connectionOf(m).ap} />
                : <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.device_id ?? "—"}</td>}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

/** Nickname (or model) on top; model, gateway tag and MAC below. */
function ConnectedApCell({ ap }: { ap: ConnectedAp | null }) {
  if (!ap) return <td className="px-4 py-3 text-neutral-400">—</td>;
  return (
    <td className="px-4 py-3">
      <p className="font-medium text-neutral-900">{ap.name ?? (ap.model || "Unknown AP")}</p>
      <p className="mt-0.5 text-xs text-neutral-500">
        {[ap.name && ap.model, ap.gateway && "Gateway"].filter(Boolean).join(" · ")}
        {(ap.name && ap.model) || ap.gateway ? " · " : ""}
        <span className="font-mono">{ap.mac}</span>
      </p>
    </td>
  );
}

interface NetworkMembersTableProps {
  members: Member[];
  /** How / where each client is connected (MCP visualizer): port / switch and the AP's name, model, MAC. */
  connection?: ConnectionOf;
  /** Optional row selection, used by the MCP visualizer to sync with its graph. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function NetworkMembersTable({ members, selectedId, onSelect, connection }: NetworkMembersTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("connected");
  const [sortKey, setSortKey] = useState<SortKey>("alias");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Record<SortKey, string>>({
    alias: "", status: "", wifi: "", ipv4: "", device_id: "",
  });

  const connectedMembers    = useMemo(() => members.filter((m) => m.connected),  [members]);
  const notConnectedMembers = useMemo(() => members.filter((m) => !m.connected), [members]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab as TabId);
    setFilters({ alias: "", status: "", wifi: "", ipv4: "", device_id: "" });
  }

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">No devices found in this network.</p>;
  }

  const tabTriggerClass = (active: boolean) =>
    cn(
      "relative px-5 py-2.5 text-sm font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1",
      active
        ? "text-blue-700 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600"
        : "text-neutral-500 hover:text-neutral-800"
    );

  return (
    <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
      <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200">
        <Tabs.List className="flex border-b border-neutral-200 bg-white">
          <Tabs.Trigger value="connected" className={tabTriggerClass(activeTab === "connected")}>
            Connected
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "connected" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
            )}>
              {connectedMembers.length}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="not-connected" className={tabTriggerClass(activeTab === "not-connected")}>
            Not Connected
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "not-connected" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-500"
            )}>
              {notConnectedMembers.length}
            </span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="connected">
          <DeviceTable
            members={connectedMembers}
            filters={filters}
            setFilters={setFilters}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            selectedId={selectedId}
            onSelect={onSelect}
            connection={connection}
          />
        </Tabs.Content>

        <Tabs.Content value="not-connected">
          <DeviceTable
            members={notConnectedMembers}
            filters={filters}
            setFilters={setFilters}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            selectedId={selectedId}
            onSelect={onSelect}
            connection={connection}
          />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
