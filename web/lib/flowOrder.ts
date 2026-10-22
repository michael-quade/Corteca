// Child order for the topology layout: what hangs off a device follows its port
// numbers — LAN 1, LAN 2, … (switches, wired clients, Beacons wired straight into a
// port), then wireless Beacons, then the WiFi client card. Nodes are emitted in
// depth-first order with children sorted this way; layoutFlowGraph() makes ELK keep
// that order: left → right (Tree), top → bottom (Sideways), clockwise (Radial).

import type { Edge } from "@xyflow/react";
import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { FlowNode, BackhaulEdgeData, SwitchEdgeData, WiredEdgeData } from "@/web/lib/topologyFlow";
import { clientName } from "@/web/lib/clientFields";
import { lanNumber, wiredPort } from "@/web/lib/inferredSwitches";

const WIRELESS = 1000, CARD = 2000;

/** Sort key of an edge's child: its port number, else after all ports. */
function childKey(network: McpNetwork, e: Edge): { rank: number; name: string } {
  if (e.type === "switchUplink") {
    const { sw } = e.data as SwitchEdgeData;
    return { rank: lanNumber(sw.port), name: sw.id };
  }
  if (e.type === "wiredLink") {
    const { member } = e.data as WiredEdgeData;
    const wp = wiredPort(network, member);
    return { rank: wp && wp.order < 99 ? wp.order - 1 : WIRELESS - 1, name: clientName(member) };
  }
  if (e.type === "backhaul") {
    const { link } = e.data as BackhaulEdgeData;
    const port = network.beaconPorts?.[link.childMac];
    // Behind a switch, Beacons come before the switch's wired clients.
    if (e.source.startsWith("sw:")) return { rank: 0, name: link.childMac };
    return { rank: port ?? WIRELESS, name: link.childMac };
  }
  return { rank: CARD, name: e.target };
}

export function orderForLayout(network: McpNetwork, nodes: FlowNode[], edges: Edge[]): { nodes: FlowNode[]; edges: Edge[] } {
  const children = new Map<string, Edge[]>();
  const hasParent = new Set<string>();
  for (const e of edges) {
    children.set(e.source, [...(children.get(e.source) ?? []), e]);
    hasParent.add(e.target);
  }
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    const kids = (children.get(id) ?? []).map((e) => ({ e, k: childKey(network, e) }));
    kids.sort((a, b) => a.k.rank - b.k.rank || a.k.name.localeCompare(b.k.name));
    for (const { e } of kids) visit(e.target);
  };
  const root = network.aps.find((a) => a.role === "root")?.mac;
  // The Internet node first: it sits above the gateway.
  nodes.filter((n) => n.type === "internet").forEach((n) => visit(n.id));
  if (root) visit(root);
  nodes.filter((n) => !hasParent.has(n.id)).forEach((n) => visit(n.id));
  nodes.forEach((n) => visit(n.id));

  const index = new Map(order.map((id, i) => [id, i]));
  const at = (id: string) => index.get(id) ?? order.length;
  return {
    nodes: [...nodes].sort((a, b) => at(a.id) - at(b.id)),
    edges: [...edges].sort((a, b) => at(a.target) - at(b.target)),
  };
}
