// Recently viewed networks for the MCP visualizer, kept in this browser only.

import type { Subscriber } from "@/web/lib/corteca/types";

export interface RecentNetwork {
  networkId: string;
  label: string;                 // subscriber name, or "Shared link"
  subscriber: Subscriber | null; // kept so reopening restores the header chip
  viewedAt: string;              // ISO
}

const KEY = "mcp-visualizer:recent-networks";
const MAX = 12;

export function loadRecentNetworks(): RecentNetwork[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentNetwork[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.networkId === "string") : [];
  } catch {
    return [];
  }
}

/** Moves (or adds) a network to the top of the list and returns the new list. */
export function rememberNetwork(entry: Omit<RecentNetwork, "viewedAt">): RecentNetwork[] {
  const prev = loadRecentNetworks();
  const existing = prev.find((r) => r.networkId === entry.networkId);
  // Don't let a shared-link visit erase a subscriber we already know for this network.
  const merged: RecentNetwork = {
    ...entry,
    label: entry.subscriber ? entry.label : existing?.label ?? entry.label,
    subscriber: entry.subscriber ?? existing?.subscriber ?? null,
    viewedAt: new Date().toISOString(),
  };
  const next = [merged, ...prev.filter((r) => r.networkId !== entry.networkId)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

export function clearRecentNetworks(): RecentNetwork[] {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  return [];
}
