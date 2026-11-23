// One-glance summary of an MCP network: gateway, APs by model, clients by wired / band.
// Used by the diagram's Network summary drawer and the Clients section heading.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Band } from "@/web/lib/topologyFlow";
import { clientBand, isMloClient, isWired } from "@/web/lib/clientFields";

export const SUMMARY_BANDS: Band[] = ["6 GHz", "5 GHz", "2.4 GHz"];

export interface ApModelCount { model: string; count: number; gateway: boolean }

export interface NetworkSummary {
  gateway: { model: string; firmware: string; online: boolean; mac: string } | null;
  aps: { total: number; online: number; models: ApModelCount[] };
  clients: {
    total: number;
    wifi: number;
    wired: number;
    /** WiFi clients per band they are filed under (an MLO client counts once, on its filed band). */
    bands: Record<Band, number>;
    /** WiFi 7 multi-link clients (already counted in `bands`). */
    mlo: number;
  };
}

/** Counts what is online now (MCP lists only connected clients; `connected` guards anyway). */
export function summariseNetwork(network: McpNetwork): NetworkSummary {
  const root = network.aps.find((a) => a.role === "root") ?? null;

  // Gateway's model first, then the rest by count.
  const byModel = new Map<string, ApModelCount>();
  if (root) byModel.set(`gw:${root.model}`, { model: root.model || "Unknown model", count: 1, gateway: true });
  for (const ap of network.aps) {
    if (ap === root) continue;
    const key = ap.model || "Unknown model";
    const entry = byModel.get(key) ?? { model: key, count: 0, gateway: false };
    entry.count += 1;
    byModel.set(key, entry);
  }
  const models = [...byModel.values()].sort((a, b) => Number(b.gateway) - Number(a.gateway) || b.count - a.count || a.model.localeCompare(b.model));

  const bands: Record<Band, number> = { "6 GHz": 0, "5 GHz": 0, "2.4 GHz": 0, Wired: 0, Other: 0 };
  let wired = 0, wifi = 0, mlo = 0;
  for (const m of network.members) {
    if (!m.connected) continue;
    if (isWired(m)) { wired += 1; continue; }
    wifi += 1;
    bands[clientBand(m)] += 1;
    if (isMloClient(m)) mlo += 1;
  }
  bands.Wired = wired;

  return {
    gateway: root ? { model: root.model, firmware: root.firmware, online: root.online, mac: root.mac } : null,
    aps: { total: network.aps.length, online: network.aps.filter((a) => a.online).length, models },
    clients: { total: wifi + wired, wifi, wired, bands, mlo },
  };
}

/** "83 · 71 WiFi · 12 wired" for the folded Clients section. */
export function clientsLine(s: NetworkSummary): string {
  return `${s.clients.total} · ${s.clients.wifi} WiFi · ${s.clients.wired} wired`;
}
