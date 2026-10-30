"use client";

import { useState, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import { EMPTY_FILTERS, MemberDeviceTable, type ConnectionOf, type SortDir, type SortKey } from "./MemberDeviceTable";

type TabId = "connected" | "not-connected";

/** The second tab's clients when they come from elsewhere than `members` (MCP: Corteca's REST history). */
export interface DisconnectedTab {
  label: string;
  status: "loading" | "error" | "ready";
  members: Member[];
  /** Shown under the tab bar, e.g. what "recently" means. */
  note?: string;
  empty?: string;
}

interface NetworkMembersTableProps {
  members: Member[];
  /** How / where each client is connected (MCP visualizer): port / switch and the AP's name, model, MAC. */
  connection?: ConnectionOf;
  disconnected?: DisconnectedTab;
  /** Optional row selection, used by the MCP visualizer to sync with its graph (connected tab only). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const DEFAULT_SORT: Record<TabId, [SortKey, SortDir]> = { connected: ["alias", "asc"], "not-connected": ["last_seen", "desc"] };

export function NetworkMembersTable({ members, selectedId, onSelect, connection, disconnected }: NetworkMembersTableProps) {
  const [activeTab, setActiveTab] = useState<TabId>("connected");
  const [sortKey, setSortKey] = useState<SortKey>("alias");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Record<SortKey, string>>(EMPTY_FILTERS);

  const connectedMembers = useMemo(() => members.filter((m) => m.connected), [members]);
  const ownDisconnected = useMemo(() => members.filter((m) => !m.connected), [members]);
  const tab2 = disconnected ?? { label: "Not Connected", status: "ready" as const, members: ownDisconnected };

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "last_seen" ? "desc" : "asc");
    }
  }

  function handleTabChange(tab: string) {
    const t = tab as TabId;
    setActiveTab(t);
    setFilters(EMPTY_FILTERS);
    setSortKey(DEFAULT_SORT[t][0]);
    setSortDir(DEFAULT_SORT[t][1]);
  }

  if (members.length === 0 && !disconnected) {
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
  const table = { filters, setFilters, sortKey, sortDir, onSort: handleSort, connection };

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
            {tab2.label}
            {tab2.status === "loading"
              ? <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-blue-600 align-[-2px]" aria-label="Loading" />
              : tab2.status === "ready" && (
                <span className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                  activeTab === "not-connected" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-500"
                )}>
                  {tab2.members.length}
                </span>
              )}
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="connected">
          <MemberDeviceTable {...table} members={connectedMembers} selectedId={selectedId} onSelect={onSelect} empty="No connected devices." />
        </Tabs.Content>

        <Tabs.Content value="not-connected">
          {tab2.note && <p className="border-b border-neutral-100 bg-white px-4 py-2 text-xs text-neutral-500">{tab2.note}</p>}
          {tab2.status === "loading" && <p className="bg-white px-4 py-6 text-center text-sm text-neutral-500">Loading client history from Corteca…</p>}
          {tab2.status === "error" && <p className="bg-white px-4 py-6 text-center text-sm text-neutral-500">Corteca's client history couldn't be read. Refresh to try again.</p>}
          {tab2.status === "ready" && (
            <MemberDeviceTable {...table} history members={tab2.members} empty={disconnected?.empty ?? "No disconnected devices."} />
          )}
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
}
