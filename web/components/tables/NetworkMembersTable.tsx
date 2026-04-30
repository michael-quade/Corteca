"use client";

import { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";

type SortKey = "alias" | "status" | "wifi" | "ipv4" | "device_id";
type SortDir = "asc" | "desc";

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
  if (m.paused)   return "paused";
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
          {/* Funnel icon */}
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

interface NetworkMembersTableProps {
  members: Member[];
}

export function NetworkMembersTable({ members }: NetworkMembersTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("alias");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Record<SortKey, string>>({
    alias: "", status: "", wifi: "", ipv4: "", device_id: "",
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">No devices found in this network.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {COLUMNS.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
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
    </div>
  );
}
