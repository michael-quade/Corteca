// "Recently disconnected" clients for the MCP visualizer. MCP's retrieve-network-data lists only
// clients online now; Corteca's REST members endpoint keeps the history, which also holds the
// Beacons' own radio / backhaul MACs and repeats of one device under randomized MACs.

import type { Member } from "@/web/lib/corteca/types";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { nicknameFor, type DeviceNames } from "@/web/lib/deviceNames";

export const RECENT_DAYS = 30;

/** A disconnected client, with the other MACs it was seen under (randomized MAC repeats). */
export type DisconnectedMember = Member & { otherMacs?: string[] };

// Beacons list themselves by model ("Beacon 9", "Nokia WiFi Beacon 19.1", "Beacon 19_1").
const BEACON_NAME = /^(nokia\s+wifi\s+)?beacon[\s_-]*\d/i;
const norm = (mac: string) => mac.toUpperCase().replace(/:/g, "-");

type Raw = Member & { hostname?: string; extender_id?: string; port_number?: number; rx_statistics?: unknown; tx_statistics?: unknown };

/** Locally administered = a randomized (private) MAC, as phones and watches use per network. */
export const isRandomizedMac = (mac: string) => /^.[26AE]/i.test(mac);

// The history lists some wired clients as "wifi" with channel -1 and their LAN port_number (2 = LAN 1).
function asHistoryRow(m: Raw): Raw {
  const wiredByPort = m.channel === -1 && (m.port_number ?? 0) >= 2;
  // Rates in the history are from the last time it was seen, not a link speed now.
  const { rx_statistics: _rx, tx_statistics: _tx, ...rest } = m;
  void _rx; void _tx;
  return { ...rest, type: wiredByPort ? "ethernet" : m.type, channel: m.channel === -1 ? undefined : m.channel } as Raw;
}

export function recentlyDisconnected(
  history: Member[], network: McpNetwork, names: DeviceNames | null, now = Date.now(),
): DisconnectedMember[] {
  const apMacs = new Set(network.aps.map((a) => norm(a.mac)));
  const online = new Set(network.members.map((m) => norm(m.id)));
  const since = now - RECENT_DAYS * 86_400_000;

  const kept = (history as Raw[]).flatMap((m): DisconnectedMember[] => {
    const id = norm(m.id);
    if (m.connected || online.has(id) || apMacs.has(id)) return [];
    const seen = Date.parse(m.last_seen ?? "");
    if (!(seen >= since)) return [];
    const name = nicknameFor(names, id) ?? m.alias ?? m.hostname;
    if (name && BEACON_NAME.test(name.trim())) return [];
    if (names?.get(id.replace(/-/g, ""))?.category === "WIFI_EXTENDER") return [];
    // The AP it was last on: a Beacon's client lists the gateway as device_id and the Beacon as extender_id.
    return [{ ...asHistoryRow(m), id, alias: name || undefined, device_id: m.extender_id ?? m.device_id }];
  });

  // One row per name among randomized MACs: a phone shows up once per MAC it rotated through.
  // Factory MACs with one name (three "SonosZP" speakers) are separate devices and stay separate.
  const byName = new Map<string, DisconnectedMember>();
  const rows: DisconnectedMember[] = [];
  for (const m of kept.sort((a, b) => Date.parse(b.last_seen!) - Date.parse(a.last_seen!))) {
    const k = isRandomizedMac(m.id) ? m.alias?.trim().toLowerCase() : undefined;
    const first = k ? byName.get(k) : undefined;
    if (first) { first.otherMacs = [...(first.otherMacs ?? []), m.id]; continue; }
    if (k) byName.set(k, m);
    rows.push(m);
  }
  return rows;
}

/** "5 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string | undefined, now = Date.now()): string {
  const t = Date.parse(iso ?? "");
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
