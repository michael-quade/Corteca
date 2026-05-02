"use client";

import { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";

type SortKey = "alias" | "status" | "wifi" | "ipv4" | "device_id";
type SortDir = "asc" | "desc";
type TabId = "connected" | "not-connected";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "alias",     label: "Device" },
  { key: "status",    label: "Status" },
  { key: "wifi",      label: "WiFi" },
  { key: "ipv4",      label: "IP" },
  { key: "device_id", label: "Connected AP" },
];

function formatFrequency(mhz: number) {
  return mhz >= 1000 ? `${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`;
}

function wifiLabel(m: Member) {
  return [
    m.wifi_standard,
    m.channel   != null && `Ch ${m.channel}`,
    m.frequency != null && formatFrequency(m.frequency),
  ].filter(Boolean).join(" · ");
}

function statusLabel(m: Member) {
  if (m.paused) return "paused";
  return m.connected ? "connected" : "offline";
}

function statusOrder(m: Member) {
  if (m.paused) return 1;
  return m.connected ? 2 : 0;
}

function getValue(m: Member, key: SortKey): string {
  switch (key) {
    case "alias":     return (m.alias ?? m.id).toLowerCase();
    case "status":    return statusLabel(m);
    case "wifi":      return wifiLabel(m).toLowerCase();
    case "ipv4":      return m.ipv4 ?? "";
    case "device_id": return m.device_id ?? "";
  }
}

function StatusBadge({ connected, paused }: { connected: boolean; paused?: boolean }) {
  if (paused) {
    return (
      <span className="flex items-center gap-1.5 text-orange-600">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-orange-400" />
        Paused
      </span>
    );
  }
  if (connected) {
    return (
      <span className="flex items-center gap-1.5 text-green-700">
        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
        Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-red-600">
      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
      Offline
    </span>
  );
}

interface FilterPopoverProps {
  value: string;
  onChange: (v: string) => void;
  active: boolean;
}

function FilterPopover({ value, onChange, active }: FilterPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Filter"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-neutral-200",
            active ? "text-blue-600" : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2Z" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className={cn(
            "z-50 min-w-[180px] rounded-md border border-neutral-200 bg-white p-2 shadow-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          <p className="mb-1.5 text-xs font-medium text-neutral-500">Filter</p>
          <input
            autoFocus
            type="text"
            placeholder="Type to filter…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "w-full rounded border border-neutral-200 px-2 py-1.5 text-sm",
              "placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
            )}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-1.5 w-full rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              Clear filter
            </button>
          )}
          <Popover.Arrow className="fill-neutral-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DeviceTable({ members, filters, setFilters, sortKey, sortDir, onSort }: {
  members: Member[];
  filters: Record<SortKey, string>;
  setFilters: (fn: (f: Record<SortKey, string>) => Record<SortKey, string>) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const rows = useMemo(() => {
    let result = [...members];
    for (const col of COLUMNS) {
      const term = filters[col.key].trim().toLowerCase();
      if (term) result = result.filter((m) => getValue(m, col.key).includes(term));
    }
    result.sort((a, b) => {
      const av = sortKey === "status" ? statusOrder(a) : getValue(a, sortKey);
      const bv = sortKey === "status" ? statusOrder(b) : getValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [members, filters, sortKey, sortDir]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-neutral-200 bg-neutral-50">
          {COLUMNS.map((col) => (
            <th key={col.key} className="px-4 py-3 text-left">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-800"
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
            <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-sm text-neutral-400">
              No devices match the current filters.
            </td>
          </tr>
        ) : (
          rows.map((m) => (
            <tr key={m.id} className="bg-white transition-colors hover:bg-neutral-50">
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">{m.alias ?? "—"}</p>
                <p className="mt-0.5 font-mono text-xs text-neutral-400">{m.id}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge connected={m.connected} paused={m.paused} />
              </td>
              <td className="px-4 py-3 text-neutral-600">{wifiLabel(m) || "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.ipv4 ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-neutral-500">{m.device_id ?? "—"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

interface NetworkMembersTableProps {
  members: Member[];
}

export function NetworkMembersTable({ members }: NetworkMembersTableProps) {
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
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1",
      active
        ? "text-neutral-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-neutral-900"
        : "text-neutral-500 hover:text-neutral-700"
    );

  return (
    <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <Tabs.List className="flex border-b border-neutral-200 bg-neutral-50">
          <Tabs.Trigger value="connected" className={tabTriggerClass(activeTab === "connected")}>
            Connected
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "connected" ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
            )}>
              {connectedMembers.length}
            </span>
          </Tabs.Trigger>
          <Tabs.Trigger value="not-connected" className={tabTriggerClass(activeTab === "not-connected")}>
            Not Connected
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "not-connected" ? "bg-red-100 text-red-600" : "bg-neutral-200 text-neutral-500"
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
          />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
