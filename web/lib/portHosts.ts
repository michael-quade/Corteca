// Interprets the gateway's per-port host list (Device.Hosts.Host by Layer1Interface).
// A port's host list includes everything bridged behind it, so with Ethernet-
// backhauled Beacons it also contains every client of those Beacons. Using the
// MCP mesh/members data we split it into what is really on the port.

import type { Member } from "@/web/lib/corteca/types";
import type { EthernetPort } from "@/web/components/EthernetPortPanel";

const norm = (m: string) => m.toUpperCase().replace(/[:\-]/g, "");

/** The minimum a page needs to supply (an McpNetwork already fits). */
export interface PortAp { mac: string; role: string; model: string; nickname?: string }
export interface PortContext { aps: PortAp[]; members: Member[] }

export interface PortHosts {
  /** Mesh APs plugged into this port (directly or through a switch). */
  beacons: PortAp[];
  /** Devices reached through one of those Beacons — not physically on the port. */
  via: { member: Member; ap: PortAp }[];
  /** Everything else: devices wired to the port or to a switch on it. */
  direct: { mac: string; hostName: string; member?: Member }[];
}

export function classifyPortHosts(port: EthernetPort, network: PortContext): PortHosts {
  const apByMac = new Map(network.aps.map((a) => [norm(a.mac), a]));
  const memberByMac = new Map(network.members.map((m) => [norm(m.id), m]));
  const out: PortHosts = { beacons: [], via: [], direct: [] };
  for (const h of port.connectedHosts ?? []) {
    const mac = norm(h.macAddress);
    const ap = apByMac.get(mac);
    if (ap) { if (ap.role !== "root") out.beacons.push(ap); continue; }
    const member = memberByMac.get(mac);
    const homeAp = member?.device_id ? apByMac.get(norm(member.device_id)) : undefined;
    if (member && homeAp && homeAp.role !== "root") out.via.push({ member, ap: homeAp });
    else out.direct.push({ mac: h.macAddress, hostName: h.hostName, member });
  }
  return out;
}

/** More than one Beacon/device on a single port means something bridges there (switch, hub, pass-through). */
export const looksLikeSwitch = (c: PortHosts) => c.beacons.length + c.direct.length > 1;

/** Ports in display order with the labels the panel uses ("WAN", "LAN 1", …). */
export function labelPorts(ports: EthernetPort[]): { port: EthernetPort; label: string }[] {
  let lan = 0;
  return ports.map((port) => ({ port, label: port.upstream ? "WAN" : `LAN ${++lan}` }));
}

/** The gateway port a mesh AP's Ethernet backhaul arrives on, from the gateway's host table. */
export function gatewayPortOf(apMac: string, ports: EthernetPort[], network: PortContext): { label: string; viaSwitch: boolean } | null {
  for (const { port, label } of labelPorts(ports)) {
    if (port.upstream) continue;
    if ((port.connectedHosts ?? []).some((h) => norm(h.macAddress) === norm(apMac))) {
      return { label, viaSwitch: looksLikeSwitch(classifyPortHosts(port, network)) };
    }
  }
  return null;
}
