// Switches inferred in a home network, drawn on the topology canvas as dashed
// "Switch (inferred)" cards between the port and what sits behind it.
//  - Gateway ports (live): the gateway's host table per Ethernet port, split by
//    portHosts.ts; ≥2 Beacons/direct devices on a port whose link is Up.
//  - Any AP port (reported): ≥2 connected wired clients Corteca reports on the
//    same `port_number` of one AP. Used for mesh APs (no port data of their own)
//    and for the gateway when live ports are unavailable.
// Only what is behind a switch on a port can be seen: chained switches show as one,
// and a Beacon behind a mesh AP's switch isn't visible.

import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import { classifyPortHosts, labelPorts, looksLikeSwitch } from "@/web/lib/portHosts";

export interface InferredSwitch {
  /** React Flow node id: "sw:<AP MAC>:<port label>". */
  id: string;
  apMac: string;
  /** "LAN 1" */
  port: string;
  /** Negotiated rate of the AP port the switch is on (live gateway ports only). */
  rateMbps: number | null;
  source: "live" | "reported";
  beaconMacs: string[];
  clientIds: string[];
  /** Live host-table devices on the port that Corteca doesn't list as clients. */
  otherHosts: { mac: string; name: string }[];
}

const wired = (m: Member) => String(m.type ?? "").toLowerCase() === "ethernet";
const portNumber = (m: Member) => Number((m as unknown as { port_number?: number }).port_number) || null;
// Corteca numbers ports from 1 = WAN, so port 2 is the first LAN port.
const portLabel = (n: number) => (n === 1 ? "WAN" : `LAN ${n - 1}`);

function liveGatewaySwitches(network: McpNetwork, rootMac: string, ports: EthernetPort[]): InferredSwitch[] {
  const parentOf = new Map(network.backhaul.map((l) => [l.childMac, l.parentMac]));
  const out: InferredSwitch[] = [];
  for (const { port, label } of labelPorts(ports)) {
    if (port.upstream || port.status !== "Up") continue;
    const hosts = classifyPortHosts(port, network);
    if (!looksLikeSwitch(hosts)) continue;
    out.push({
      id: `sw:${rootMac}:${label}`,
      apMac: rootMac,
      port: label,
      rateMbps: port.currentBitRate > 0 ? port.currentBitRate : null,
      source: "live",
      // Beacons whose backhaul really comes from the gateway (not via another AP).
      beaconMacs: hosts.beacons.map((b) => b.mac).filter((mac) => parentOf.get(mac) === rootMac),
      clientIds: hosts.direct.flatMap((d) => (d.member && d.member.device_id === rootMac ? [d.member.id] : [])),
      otherHosts: hosts.direct.filter((d) => !d.member).map((d) => ({ mac: d.mac, name: d.hostName })),
    });
  }
  return out;
}

function reportedSwitches(network: McpNetwork, apMac: string): InferredSwitch[] {
  const byPort = new Map<number, Member[]>();
  for (const m of network.members) {
    const n = m.connected && m.device_id === apMac && wired(m) ? portNumber(m) : null;
    if (n) byPort.set(n, [...(byPort.get(n) ?? []), m]);
  }
  return [...byPort].filter(([, list]) => list.length >= 2).map(([n, list]) => ({
    id: `sw:${apMac}:${portLabel(n)}`,
    apMac,
    port: portLabel(n),
    rateMbps: null,
    source: "reported" as const,
    beaconMacs: [],
    clientIds: list.map((m) => m.id),
    otherHosts: [],
  }));
}

/** Inferred switches; `gatewayPorts` are the gateway's live ports when available. */
export function inferSwitches(network: McpNetwork, gatewayPorts: EthernetPort[] | null): InferredSwitch[] {
  const rootMac = network.aps.find((a) => a.role === "root")?.mac;
  const live = rootMac && gatewayPorts?.length ? liveGatewaySwitches(network, rootMac, gatewayPorts) : null;
  return [
    ...(live ?? []),
    ...network.aps.filter((a) => !(live && a.mac === rootMac)).flatMap((a) => reportedSwitches(network, a.mac)),
  ].filter((sw) => sw.beaconMacs.length + sw.clientIds.length >= 2);
}

export function applySwitches(network: McpNetwork, gatewayPorts: EthernetPort[] | null): McpNetwork {
  const switches = inferSwitches(network, gatewayPorts);
  return switches.length ? { ...network, switches } : network;
}

// ── Lookups shared by the graph, highlighting and panels ─────────────────────

export const switchById = (network: McpNetwork, id: string) => network.switches?.find((s) => s.id === id);
export const switchOfBeacon = (network: McpNetwork, mac: string) => network.switches?.find((s) => s.beaconMacs.includes(mac));
export const switchOfClient = (network: McpNetwork, id: string) => network.switches?.find((s) => s.clientIds.includes(id));

/** The node a client's card hangs off: its switch, else its AP. */
export function clientOwner(network: McpNetwork, m: Member): string | undefined {
  return switchOfClient(network, m.id)?.id ?? m.device_id;
}

/** Label on the AP → switch line, e.g. "LAN 1 · 1.0 Gbps". */
export function switchUplinkLabel(sw: InferredSwitch): string {
  const rate = sw.rateMbps;
  return [sw.port, rate ? (rate >= 1000 ? `${(rate / 1000).toFixed(1)} Gbps` : `${rate} Mbps`) : null].filter(Boolean).join(" · ");
}

// ── Wired clients' port and link speed ───────────────────────────────────────

export interface WiredPort {
  /** "LAN 2" (Corteca port_number − 1; matches the gateway's live ports), null if not reported. */
  port: string | null;
  /** Negotiated link speed of a device plugged straight into the port. */
  speedMbps: number | null;
  /** Behind an inferred switch, Corteca's rate is the AP↔switch link, not the device's, so speed is null. */
  viaSwitch: InferredSwitch | undefined;
  /** Sort key: port number. */
  order: number;
}

export function wiredPort(network: McpNetwork, m: Member): WiredPort | null {
  if (!wired(m)) return null;
  const n = portNumber(m);
  const viaSwitch = switchOfClient(network, m.id);
  const raw = m as unknown as { rx_statistics?: { rate?: number }; tx_statistics?: { rate?: number } };
  const kbps = Number(raw.rx_statistics?.rate ?? raw.tx_statistics?.rate) || 0;
  return {
    port: n ? portLabel(n) : null,
    speedMbps: viaSwitch || kbps <= 0 ? null : Math.round(kbps / 1000),
    viaSwitch,
    order: n ?? 99,
  };
}

/** "1G", "2.5G", "100M". */
export const shortSpeed = (mbps: number) => (mbps >= 1000 ? `${+(mbps / 1000).toFixed(1)}G` : `${mbps}M`);

/** Pill tag: "LAN 3 · 100M", or "via switch" (the switch line carries the port and shared speed). */
export function wiredTag(network: McpNetwork, m: Member): { text: string; order: number } | null {
  const wp = wiredPort(network, m);
  if (!wp) return null;
  if (wp.viaSwitch) return { text: "via switch", order: wp.order };
  const text = [wp.port, wp.speedMbps ? shortSpeed(wp.speedMbps) : null].filter(Boolean).join(" · ");
  return text ? { text, order: wp.order } : null;
}
