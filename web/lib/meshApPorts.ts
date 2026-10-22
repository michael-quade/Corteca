// Ethernet ports of a mesh AP (Beacon) for the REST Home Network Visualizer.
// Mesh APs have no Device.Ethernet object, so the ports are built from what Corteca
// reports: the port layout from the device config / model spec, wired clients'
// `port_number` and rate (members), switches inferred from ≥2 clients on one port,
// and the Ethernet backhaul (rate, and the gateway port it lands on from the
// gateway's host table). A port with nothing reported can't be called empty.

import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import type { NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import type { Member } from "@/web/lib/corteca/types";
import { normaliseMcpNetwork, type McpNetwork } from "@/web/lib/mcpNetwork";
import { applySwitches, wiredPort, type InferredSwitch } from "@/web/lib/inferredSwitches";
import { gatewayPortOf, labelPorts } from "@/web/lib/portHosts";
import { clientName } from "@/web/lib/topologyFlow";
import { getModelFallbackPorts } from "@/web/lib/ethernetPorts";

export interface ReportedPort {
  kind: "uplink" | "device" | "switch" | "none";
  /** Label on the port chip: "WAN", "1", … ("?" when Corteca gave no port number). */
  portLabel: string;
  /** Wired clients on the port (one, or several behind an inferred switch). */
  devices: { name: string; mac: string; speedMbps: number | null }[];
  /** Uplink: where the backhaul lands, e.g. "Gateway LAN 1 (switch)". */
  uplink?: string;
  switch?: InferredSwitch;
}

export type MeshPort = EthernetPort & { reported?: ReportedPort };

/** The REST mesh + members in the McpNetwork shape the switch/port helpers take. */
export function networkFromTopology(topo: NetworkTopologyData): McpNetwork {
  const raw = topo.members as unknown;
  const members = (Array.isArray(raw) ? raw : ((raw as { content?: unknown[] })?.content ?? [])) as Member[];
  const results = [
    { apiId: "mesh", ok: !!topo.mesh, status: 200, data: topo.mesh },
    { apiId: "members", ok: true, status: 200, data: members },
  ];
  return normaliseMcpNetwork({ results }, String(topo.rootDeviceId ?? ""));
}

/** McpNetwork with inferred switches; `gatewayPorts` = the gateway's live ports, if any. */
export function restNetwork(topo: NetworkTopologyData, gatewayPorts: EthernetPort[] | null): McpNetwork {
  return applySwitches(networkFromTopology(topo), gatewayPorts);
}

const kbpsToMbps = (m: Member) => {
  const kbps = Number((m as unknown as { rx_statistics?: { rate?: number } }).rx_statistics?.rate) || 0;
  return kbps > 0 ? Math.round(kbps / 1000) : null;
};

const blank = (index: number, name: string, upstream: boolean): EthernetPort => ({
  index, name, upstream, enable: true, status: "Unknown", maxBitRate: -1, currentBitRate: 0, duplexMode: "", macAddress: "", connectedHost: null,
});

/**
 * Ports of mesh AP `apMac`: `basePorts` (config/spec layout; the model spec when
 * empty) with each port filled from Corteca's reports. Clients on a port the
 * layout doesn't have, or with no port number, get extra rows.
 */
export function meshApPorts(network: McpNetwork, apMac: string, basePorts: EthernetPort[], gatewayPorts: EthernetPort[] | null): MeshPort[] {
  const ap = network.aps.find((a) => a.mac === apMac);
  const apMacs = new Set(network.aps.map((a) => a.mac));
  const layout = basePorts.length ? basePorts : getModelFallbackPorts(ap?.model ?? "");

  const byPort = new Map<string, Member[]>();
  for (const m of network.members) {
    if (!m.connected || m.device_id !== apMac || apMacs.has(m.id)) continue;
    const wp = wiredPort(network, m);
    if (!wp) continue;
    const key = wp.port ?? "LAN ?";
    byPort.set(key, [...(byPort.get(key) ?? []), m]);
  }

  const uplink = network.backhaul.find((l) => l.childMac === apMac);
  const ethernetUplink = !!uplink && uplink.medium.includes("eth");
  const gatewayMac = network.aps.find((a) => a.role === "root")?.mac;
  const landing = ethernetUplink && uplink.parentMac === gatewayMac && gatewayPorts?.length ? gatewayPortOf(apMac, gatewayPorts, network) : null;
  const uplinkText = landing ? `Gateway ${landing.label}${landing.viaSwitch ? " (switch)" : ""}` : "Parent AP";

  const fill = (port: EthernetPort, label: string): MeshPort => {
    const portLabel = label.replace(/^LAN /, "");
    const clients = byPort.get(label);
    byPort.delete(label);
    if (clients?.length) {
      const sw = clients.map((m) => wiredPort(network, m)?.viaSwitch).find(Boolean);
      // Behind a switch each client's rate is the port↔switch link, i.e. the port's own rate.
      const rates = clients.map(kbpsToMbps).filter((r): r is number => r !== null);
      return {
        ...port,
        status: "Up",
        currentBitRate: rates.length ? Math.max(...rates) : 0,
        reported: {
          kind: sw ? "switch" : "device",
          portLabel,
          devices: clients.map((m) => ({ name: clientName(m), mac: m.id, speedMbps: sw ? null : kbpsToMbps(m) })),
          switch: sw,
        },
      };
    }
    if (port.upstream && ethernetUplink) {
      return { ...port, status: "Up", currentBitRate: uplink.rateMbps ?? 0, reported: { kind: "uplink", portLabel, devices: [], uplink: uplinkText } };
    }
    return { ...port, status: "Unknown", currentBitRate: 0, reported: { kind: "none", portLabel, devices: [] } };
  };

  const out = labelPorts(layout).map(({ port, label }) => fill(port, label));
  // Clients on ports the layout doesn't list (or with no port number), then the
  // Ethernet uplink if the layout had no WAN port to put it on.
  let extra = 100;
  for (const label of [...byPort.keys()].sort()) out.push(fill(blank(extra++, label, label === "WAN"), label));
  if (ethernetUplink && !out.some((p) => p.reported?.kind === "uplink") && !layout.some((p) => p.upstream)) {
    out.unshift(fill(blank(extra++, "uplink", true), "WAN"));
  }
  return out;
}
