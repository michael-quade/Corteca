// Turns an McpNetwork into React Flow nodes/edges (AP cards, one client node
// per AP with stacked band sections, backhaul links) and lays them out
// top-down with ELK. One client node per AP keeps each subtree one card wide.

import type { Edge, Node } from "@xyflow/react";
import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { center, spreadRadial, straightRoute, type Box, type Point } from "@/web/lib/edgeGeometry";
import type { Member } from "@/web/lib/corteca/types";

// ── Sizes (must match the node components) ───────────────────────────────────

export const AP_W = 232, AP_H = 84;
export const SW_W = 200, SW_H = 60;
export const NET_W = 200, NET_H = 60;
/** Id of the Internet node above the gateway, and of its WAN edge. */
export const INTERNET_ID = "internet", WAN_EDGE_ID = "wan";
export { CLUSTER_W, CLUSTER_COLLAPSE_AT } from "@/web/lib/clientCluster";
export { clientBand, clientName, clientSignalDbm, isWired } from "@/web/lib/clientFields";
import { clusterNode, WIRED_H, wiredNodeWidth } from "@/web/lib/clientCluster";
import { orderForLayout } from "@/web/lib/flowOrder";
import { formatRate } from "@/web/lib/rateFormat";
import { clientBand } from "@/web/lib/clientFields";
import { wanLinkSpeedMbps } from "@/web/lib/wanInfo";
import { clientOwner, switchOfBeacon, switchUplinkLabel, wiredLinkLabel, type InferredSwitch } from "@/web/lib/inferredSwitches";

// ── Types ────────────────────────────────────────────────────────────────────

export type Quality = "good" | "fair" | "poor" | "unknown";
export type LayoutMode = "tree" | "horizontal" | "radial";
export type Band = "2.4 GHz" | "5 GHz" | "6 GHz" | "Wired" | "Other";

export interface ClientPill {
  id: string;
  name: string;
  signal: Quality | null;   // null = wired
  width: number;
  twoLines: boolean;
}

export interface ApNodeData extends Record<string, unknown> { ap: McpAccessPoint }
export interface ClientSection {
  id: string;
  band: Band;
  total: number;
  pills: ClientPill[];
  hidden: number;           // collapsed into "+N"
  expanded: boolean;
}
export interface ClusterNodeData extends Record<string, unknown> {
  sections: ClientSection[];
  onToggle: (sectionId: string) => void;
}
/** `points`: the edge's route in flow coordinates, set by layoutFlowGraph(). */
export interface BackhaulEdgeData extends Record<string, unknown> { link: McpBackhaulLink; points?: Point[] }
export interface RouteEdgeData extends Record<string, unknown> { points?: Point[] }

export interface SwitchNodeData extends Record<string, unknown> { sw: InferredSwitch }
export interface WiredNodeData extends Record<string, unknown> { member: Member }
/** `label`: port and speed ("LAN 3 · 100M"); null behind a switch. */
export interface WiredEdgeData extends Record<string, unknown> { member: Member; label: string | null; points?: Point[] }
export interface SwitchEdgeData extends Record<string, unknown> { sw: InferredSwitch; points?: Point[] }
export interface InternetNodeData extends Record<string, unknown> { gateway: McpAccessPoint; wan: McpNetwork["wan"] }
export interface WanEdgeData extends Record<string, unknown> { gatewayMac: string; label: string; points?: Point[] }

export type ApFlowNode = Node<ApNodeData, "ap">;
export type SwitchFlowNode = Node<SwitchNodeData, "switch">;
export type WiredFlowNode = Node<WiredNodeData, "wired">;
export type ClusterFlowNode = Node<ClusterNodeData, "cluster">;
export type InternetFlowNode = Node<InternetNodeData, "internet">;
export type FlowNode = ApFlowNode | ClusterFlowNode | SwitchFlowNode | WiredFlowNode | InternetFlowNode;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function linkQuality(link: McpBackhaulLink): Quality {
  const q = link.quality;
  return q === "good" || q === "fair" || q === "poor" ? q : "unknown";
}

export const isEthernet = (link: McpBackhaulLink) => link.medium.includes("eth");

/** Ethernet backhaul that negotiated below gigabit usually means a bad cable or port. */
export const SLOW_ETHERNET_MBPS = 1000;

export const formatLinkRate = (mbps: number) => formatRate(mbps);

/** Text of a backhaul edge's label — shared by the edge and the layout checks. */
export function backhaulLabel(link: McpBackhaulLink): { text: string; slowEth: boolean } {
  const eth = isEthernet(link);
  const rate = link.rateMbps ?? 0;
  const slowEth = eth && rate > 0 && rate < SLOW_ETHERNET_MBPS;
  const parts = [
    // A gateway port names the line like switch / wired-client lines ("LAN 1 · 10 Gbps"); grey already says Ethernet.
    eth ? link.port ?? "Ethernet" : null,
    !eth && link.rssiDbm != null ? `${link.rssiDbm} dBm` : null,
    rate > 0 ? formatLinkRate(rate) : null,
  ].filter(Boolean);
  const text = parts.join(" · ") || (eth ? "Ethernet" : "WiFi backhaul");
  return { text: slowEth ? `⚠ ${text}` : text, slowEth };
}

/** Text of the WAN link pill: "WAN · 5 Gbps" (just "WAN" until the gateway reports the port). */
export function wanLabel(wan: McpNetwork["wan"]): string {
  const mbps = wan && wan !== "error" ? wanLinkSpeedMbps(wan) : null;
  return mbps ? `WAN · ${formatLinkRate(mbps)}` : "WAN";
}

// ── Graph ────────────────────────────────────────────────────────────────────

export function buildFlowGraph(
  network: McpNetwork,
  expanded: Set<string>,
  onToggle: (clusterId: string) => void,
  mode: LayoutMode = "tree",
): { nodes: FlowNode[]; edges: Edge[] } {
  const nodes: FlowNode[] = [];
  const edges: Edge[] = [];

  for (const ap of network.aps) {
    nodes.push({ id: ap.mac, type: "ap", position: { x: 0, y: 0 }, data: { ap }, width: AP_W, height: AP_H });
  }

  // The Internet above the gateway, joined by its WAN link.
  const gateway = network.aps.find((a) => a.role === "root");
  if (gateway) {
    nodes.push({ id: INTERNET_ID, type: "internet", position: { x: 0, y: 0 }, data: { gateway, wan: network.wan }, width: NET_W, height: NET_H });
    edges.push({ id: WAN_EDGE_ID, source: INTERNET_ID, target: gateway.mac, type: "wan", data: { gatewayMac: gateway.mac, label: wanLabel(network.wan) } satisfies WanEdgeData });
  }

  // An inferred switch sits between its AP port and the Beacons / wired clients behind it.
  for (const sw of network.switches ?? []) {
    nodes.push({ id: sw.id, type: "switch", position: { x: 0, y: 0 }, data: { sw }, width: SW_W, height: SW_H });
    edges.push({ id: `swu:${sw.id}`, source: sw.apMac, target: sw.id, type: "switchUplink", data: { sw } satisfies SwitchEdgeData });
  }

  for (const link of network.backhaul) {
    const sw = switchOfBeacon(network, link.childMac);
    edges.push({
      // The id stays parent → child (selection/highlight key) even when drawn from the switch.
      id: `bh:${link.parentMac}:${link.childMac}`,
      source: sw?.apMac === link.parentMac ? sw.id : link.parentMac,
      target: link.childMac,
      type: "backhaul",
      data: { link } satisfies BackhaulEdgeData,
    });
  }

  const apMacs = new Set(network.aps.map((a) => a.mac));
  // WiFi clients: one card per AP. Wired clients: a node each, linked from their
  // AP or inferred switch, the line labelled with port and speed.
  const byOwnerBand = new Map<string, Map<Band, Member[]>>();
  for (const m of network.members) {
    if (!m.connected || !m.device_id || !apMacs.has(m.device_id)) continue;
    const owner = clientOwner(network, m)!;
    if (clientBand(m) === "Wired") {
      nodes.push({ id: `wc:${m.id}`, type: "wired", position: { x: 0, y: 0 }, data: { member: m }, width: wiredNodeWidth(m), height: WIRED_H });
      edges.push({ id: `wl:${m.id}`, source: owner, target: `wc:${m.id}`, type: "wiredLink", data: { member: m, label: wiredLinkLabel(network, m) } satisfies WiredEdgeData });
      continue;
    }
    const bands = byOwnerBand.get(owner) ?? new Map<Band, Member[]>();
    const band = clientBand(m);
    bands.set(band, [...(bands.get(band) ?? []), m]);
    byOwnerBand.set(owner, bands);
  }

  for (const [owner, bands] of byOwnerBand) {
    const node = clusterNode(owner, bands, expanded, onToggle);
    nodes.push(node);
    edges.push({ id: `ce:${node.id}`, source: owner, target: node.id, type: "route", className: "cluster-edge", data: {} });
  }

  return orderForLayout(network, nodes, edges);
}

// ── Layout ───────────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: Record<LayoutMode, Record<string, string>> = {
  tree: {
    "elk.algorithm": "layered",
    "elk.direction": "DOWN",
    "elk.layered.spacing.nodeNodeBetweenLayers": "88",
    "elk.spacing.nodeNode": "28",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    // Keep orderForLayout()'s order: ports left → right.
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  },
  horizontal: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.layered.spacing.nodeNodeBetweenLayers": "200",
    "elk.spacing.nodeNode": "24",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    // Keep orderForLayout()'s order: ports top → bottom.
    "elk.layered.crossingMinimization.forceNodeModelOrder": "true",
  },
  radial: {
    "elk.algorithm": "radial",
    // Wide enough that a link label fits between two linked cards.
    "elk.spacing.nodeNode": "120",
    "elk.radial.compactor": "WEDGE_COMPACTION",
    // Children placed by orderId = orderForLayout()'s order.
    "elk.radial.sorter": "ID",
  },
};

interface ElkSection { startPoint: Point; endPoint: Point; bendPoints?: Point[] }

/**
 * Positions nodes with ELK and attaches each edge's route (`data.points`).
 * Layered layouts use ELK's own orthogonal routes, which go around cards; radial
 * layouts get straight centre-to-centre routes after spreadRadial() has opened
 * up enough room that no link runs under a card or loses its label.
 */
export async function layoutFlowGraph(
  nodes: FlowNode[],
  edges: Edge[],
  mode: LayoutMode = "tree",
): Promise<{ nodes: FlowNode[]; edges: Edge[] }> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: LAYOUT_OPTIONS[mode],
    children: nodes.map((n, i) => ({
      id: n.id, width: n.width ?? AP_W, height: n.height ?? AP_H,
      layoutOptions: mode === "radial" ? { "elk.radial.orderId": String(i) } : undefined,
    })),
    // Radial lays out from the node without a parent: keep that the gateway, with the Internet as its first child.
    edges: edges.map((e) => (mode === "radial" && e.id === WAN_EDGE_ID
      ? { id: e.id, sources: [e.target], targets: [e.source] }
      : { id: e.id, sources: [e.source], targets: [e.target] })),
  });

  let boxes = new Map<string, Box>((graph.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0, w: c.width ?? 0, h: c.height ?? 0 }]));
  let routes: Map<string, Point[]>;

  if (mode === "radial") {
    const root = nodes.find((n) => n.type === "ap" && (n.data as ApNodeData).ap.role === "root")?.id ?? nodes[0]?.id;
    boxes = spreadRadial(boxes, root, edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: e.type === "backhaul" ? backhaulLabel((e.data as BackhaulEdgeData).link).text
        : e.type === "switchUplink" ? switchUplinkLabel((e.data as SwitchEdgeData).sw)
        : e.type === "wiredLink" ? (e.data as WiredEdgeData).label ?? undefined
        : e.type === "wan" ? (e.data as WanEdgeData).label : undefined,
    })));
    routes = new Map(edges.map((e) => [e.id, straightRoute(boxes.get(e.source)!, boxes.get(e.target)!)]));
  } else {
    routes = new Map((graph.edges ?? []).map((e) => {
      const sec = (e as { sections?: ElkSection[] }).sections?.[0];
      return [e.id, sec ? [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint] : []];
    }));
    // Fallback for an edge ELK didn't route: straight between the two cards.
    for (const e of edges) {
      if (!routes.get(e.id)?.length && boxes.has(e.source) && boxes.has(e.target)) {
        routes.set(e.id, [center(boxes.get(e.source)!), center(boxes.get(e.target)!)]);
      }
    }
  }

  return {
    nodes: nodes.map((n) => {
      const b = boxes.get(n.id);
      return b ? { ...n, position: { x: b.x, y: b.y } } : n;
    }),
    edges: edges.map((e) => ({ ...e, data: { ...(e.data ?? {}), points: routes.get(e.id) ?? [] } })),
  };
}
