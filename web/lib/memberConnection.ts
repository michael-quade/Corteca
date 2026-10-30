// "Connection" column of the MCP visualizer's client table: how and where each client is connected.

import type { Member } from "@/web/lib/corteca/types";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import { isWired } from "@/web/lib/clientFields";
import { switchOfClient, wiredPort } from "@/web/lib/inferredSwitches";
import { formatRate } from "@/web/lib/rateFormat";

export interface MemberConnection {
  /** "Wired · LAN 3 · 100 Mbps", "Wired · LAN 1 · via switch (inferred)", "802.11ax · Ch 36 · 5.2 GHz" */
  link: string;
  /** The AP it is connected to (for a client behind a switch, the AP the switch hangs off). */
  ap: ConnectedAp | null;
}

export interface ConnectedAp {
  /** User nickname ("B9 storage room"), if any. */
  name: string | null;
  model: string;
  mac: string;
  gateway: boolean;
}

const formatFrequency = (mhz: number) => (mhz >= 1000 ? `${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`);

/** WiFi standard · channel · frequency (what the table showed before for every client). */
export function wifiLabel(m: Member): string {
  return [
    m.wifi_standard,
    m.channel != null && `Ch ${m.channel}`,
    m.frequency != null && formatFrequency(m.frequency),
  ].filter(Boolean).join(" · ");
}

export function memberConnection(network: McpNetwork, m: Member): MemberConnection {
  const sw = switchOfClient(network, m.id);
  const apMac = sw?.apMac ?? m.device_id;
  const ap = network.aps.find((a) => a.mac === apMac);
  const apName: ConnectedAp | null = ap
    ? { name: ap.nickname ?? null, model: ap.model, mac: ap.mac, gateway: ap.role === "root" }
    : apMac ? { name: null, model: "", mac: apMac, gateway: false } : null;

  if (!isWired(m)) return { link: wifiLabel(m) || "WiFi", ap: apName };

  const wp = wiredPort(network, m);
  const port = sw?.port ?? wp?.port;
  const link = sw
    ? ["Wired", port, "via switch (inferred)"]
    : ["Wired", port, wp?.speedMbps ? formatRate(wp.speedMbps) : null];
  return { link: link.filter(Boolean).join(" · "), ap: apName };
}
