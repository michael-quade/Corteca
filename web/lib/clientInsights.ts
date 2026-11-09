// Derived client facts from the MCP members payload: traffic, band capability,
// band-upgrade opportunities and readable disconnect reasons.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import { isWired } from "@/web/lib/topologyFlow";
import { clientBands } from "@/web/lib/clientFields";

interface RawMember {
  ssid?: string;
  capable_24ghz?: boolean;
  capable_5ghz?: boolean;
  capable_6ghz?: boolean;
  last_disconnected_reason_code?: number;
  rx_statistics?: { bytes?: number };
  tx_statistics?: { bytes?: number };
}
const raw = (m: Member) => m as unknown as RawMember;

/** Bytes since the counters last reset, from the AP's view: its tx is the client's download. */
export function clientTraffic(m: Member): { down: number; up: number } | null {
  const down = raw(m).tx_statistics?.bytes, up = raw(m).rx_statistics?.bytes;
  if (down == null && up == null) return null;
  return { down: down ?? 0, up: up ?? 0 };
}

export function supportedBands(m: Member): string[] {
  const r = raw(m);
  return [r.capable_24ghz && "2.4 GHz", r.capable_5ghz && "5 GHz", r.capable_6ghz && "6 GHz"].filter(Boolean) as string[];
}

const BAND_RANK: Record<string, number> = { "2.4 GHz": 1, "5 GHz": 2, "6 GHz": 3 };

/**
 * The fastest band this client supports that its AP also broadcasts the client's
 * SSID on, when that is faster than the band it is using now. Null when the client
 * is already on its best available band (e.g. an IoT SSID that only exists on 2.4 GHz).
 */
export function bandUpgrade(m: Member, network: McpNetwork): string | null {
  if (!m.connected || isWired(m)) return null;
  // An MLO client is as fast as its fastest link.
  const current = clientBands(m).sort((a, b) => (BAND_RANK[b] ?? 0) - (BAND_RANK[a] ?? 0))[0];
  const ap = network.aps.find((a) => a.mac === m.device_id);
  const offered = ap?.ssidBands[raw(m).ssid ?? ""] ?? [];
  const best = supportedBands(m)
    .filter((b) => offered.includes(b))
    .sort((a, b) => BAND_RANK[b] - BAND_RANK[a])[0];
  return best && BAND_RANK[best] > (BAND_RANK[current] ?? 99) ? best : null;
}

// IEEE 802.11 reason codes seen on home networks (0 = none recorded).
const REASONS: Record<number, string> = {
  1: "Unspecified",
  2: "Previous authentication no longer valid",
  3: "Client left (deauthenticated)",
  4: "Inactivity timeout",
  5: "AP too busy to handle all clients",
  6: "Class 2 frame from unauthenticated client",
  7: "Class 3 frame from unassociated client",
  8: "Client left (disassociated)",
  9: "Not authenticated",
  15: "4-way handshake timeout (often a wrong password)",
  23: "802.1X authentication failed",
  34: "Too many missed acknowledgements (poor signal or interference)",
};

export function disconnectReason(m: Member): string | null {
  return reasonText(raw(m).last_disconnected_reason_code);
}

/** IEEE 802.11 reason code → "Client left (deauthenticated) (code 3)"; null for none (0). */
export function reasonText(code: number | null | undefined): string | null {
  if (code == null || code === 0) return null;
  return `${REASONS[code] ?? "Reason"} (code ${code})`;
}

export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes, i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Connected clients of one AP ranked by total traffic, largest first. */
export function topTalkers(network: McpNetwork, apMac: string, limit = 3): { member: Member; total: number }[] {
  return network.members
    .filter((m) => m.connected && m.device_id === apMac)
    .map((member) => {
      const t = clientTraffic(member);
      return { member, total: t ? t.down + t.up : 0 };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
