// Turns an McpNetwork into React Flow nodes/edges (AP cards, one client node
// per AP with stacked band sections, backhaul links) and lays them out
// top-down with ELK. One client node per AP keeps each subtree one card wide.

import type { Edge, Node } from "@xyflow/react";
import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { center, spreadRadial, straightRoute, type Box, type Point } from "@/web/lib/edgeGeometry";
import type { Member } from "@/web/lib/corteca/types";

// ── Sizes (must match the node components) ───────────────────────────────────

export const AP_W = 232, AP_H = 84;
export const CLUSTER_W = 232;
const CLUSTER_PAD = 12, CLUSTER_HEADER = 22, PILL_GAP = 6, SECTION_GAP = 12;
const PILL_H1 = 24, PILL_H2 = 38, PILL_MAX = CLUSTER_W - 2 * CLUSTER_PAD;
const CHAR_W = 7.2, PILL_CHROME = 40; // text-xs average glyph width; dot + gap + padding + border
export const CLUSTER_COLLAPSE_AT = 6;

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

export type ApFlowNode = Node<ApNodeData, "ap">;
export type ClusterFlowNode = Node<ClusterNodeData, "cluster">;
export type FlowNode = ApFlowNode | ClusterFlowNode;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function linkQuality(link: McpBackhaulLink): Quality {
  const q = link.quality;
  return q === "good" || q === "fair" || q === "poor" ? q : "unknown";
}

export const isEthernet = (link: McpBackhaulLink) => link.medium.includes("eth");

/** Ethernet backhaul that negotiated below gigabit usually means a bad cable or port. */
export const SLOW_ETHERNET_MBPS = 1000;

export function formatLinkRate(mbps: number): string {
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(1)} Gbps` : `${mbps} Mbps`;
}

/** Text of a backhaul edge's label — shared by the edge and the layout checks. */
export function backhaulLabel(link: McpBackhaulLink): { text: string; slowEth: boolean } {
  const eth = isEthernet(link);
  const rate = link.rateMbps ?? 0;
  const slowEth = eth && rate > 0 && rate < SLOW_ETHERNET_MBPS;
  const parts = [
    eth ? "Ethernet" : null,
    !eth && link.rssiDbm != null ? `${link.rssiDbm} dBm` : null,
    rate > 0 ? formatLinkRate(rate) : null,
  ].filter(Boolean);
  const text = parts.join(" · ") || (eth ? "Ethernet" : "WiFi backhaul");
  return { text: slowEth ? `⚠ ${text}` : text, slowEth };
}

export function clientBand(m: Member): Band {
  if (String(m.type ?? "").toLowerCase() === "ethernet") return "Wired";
  const f = Number(m.frequency ?? 0);
  if (f >= 2400 && f < 2500) return "2.4 GHz";
  if (f >= 4900 && f < 5900) return "5 GHz";
  if (f >= 5925) return "6 GHz";
  return "Other";
}

export const isWired = (m: Member) => String(m.type ?? "").toLowerCase() === "ethernet";

export function clientSignalDbm(m: Member): number | null {
  if (isWired(m)) return null;
  const s = Number((m as unknown as { signal?: number }).signal ?? m.rssi);
  return Number.isFinite(s) && s !== 0 ? s : null;
}

// Client signal uses the same three-step scale as the links.
function clientSignal(m: Member): Quality | null {
  if (isWired(m)) return null;
  const s = clientSignalDbm(m);
  if (s == null) return "unknown";
  return s >= -65 ? "good" : s >= -75 ? "fair" : "poor";
}

export function clientName(m: Member): string {
  const host = (m as unknown as { hostname?: string }).hostname;
  return (m.alias || host || m.id).trim();
}

// Measure with the page's real text-xs font when in a browser; average glyph width otherwise.
let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = `12px ${getComputedStyle(document.body).fontFamily}`;
  }
  return measureCtx ? measureCtx.measureText(text).width : text.length * CHAR_W;
}

function toPill(m: Member): ClientPill {
  const name = clientName(m);
  const signal = clientSignal(m);
  // Wired clients have no signal dot (6px + 6px gap).
  const natural = Math.ceil(textWidth(name) + PILL_CHROME - (signal ? 0 : 12));
  return { id: m.id, name, signal, width: Math.min(PILL_MAX, natural), twoLines: natural > PILL_MAX };
}

// Greedy row packing — mirrors the section's flex-wrap so ELK gets a true height.
function pillsHeight(pills: ClientPill[], showMore: boolean): number {
  const items = pills.map((p) => ({ w: p.width, h: p.twoLines ? PILL_H2 : PILL_H1 }));
  if (showMore) items.push({ w: 44, h: PILL_H1 });
  let rows = 0, rowW = 0, rowH = 0, total = 0;
  for (const it of items) {
    if (rowW > 0 && rowW + PILL_GAP + it.w > PILL_MAX) { total += rowH; rows++; rowW = 0; rowH = 0; }
    rowW += (rowW > 0 ? PILL_GAP : 0) + it.w;
    rowH = Math.max(rowH, it.h);
  }
  if (rowW > 0) { total += rowH; rows++; }
  return total + PILL_GAP * Math.max(0, rows - 1);
}

const BAND_ORDER: Band[] = ["6 GHz", "5 GHz", "2.4 GHz", "Wired", "Other"];

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

  for (const link of network.backhaul) {
    edges.push({
      id: `bh:${link.parentMac}:${link.childMac}`,
      source: link.parentMac,
      target: link.childMac,
      type: "backhaul",
      data: { link } satisfies BackhaulEdgeData,
    });
  }

  const apMacs = new Set(network.aps.map((a) => a.mac));
  const byApBand = new Map<string, Map<Band, Member[]>>();
  for (const m of network.members) {
    if (!m.connected || !m.device_id || !apMacs.has(m.device_id)) continue;
    const bands = byApBand.get(m.device_id) ?? new Map<Band, Member[]>();
    const band = clientBand(m);
    bands.set(band, [...(bands.get(band) ?? []), m]);
    byApBand.set(m.device_id, bands);
  }

  for (const [apMac, bands] of byApBand) {
    const sections: ClientSection[] = [];
    let height = CLUSTER_PAD * 2;
    for (const band of BAND_ORDER) {
      const members = bands.get(band);
      if (!members?.length) continue;
      const id = `${apMac}:${band}`;
      // Only collapsible sections can be "expanded" (avoids a stray "less" toggle).
      const isOpen = expanded.has(id) && members.length > CLUSTER_COLLAPSE_AT;
      const all = members.map(toPill).sort((a, b) => a.name.localeCompare(b.name));
      const shown = isOpen || all.length <= CLUSTER_COLLAPSE_AT ? all : all.slice(0, CLUSTER_COLLAPSE_AT - 1);
      const showToggle = shown.length < all.length || (isOpen && all.length > CLUSTER_COLLAPSE_AT);
      if (sections.length) height += SECTION_GAP;
      height += CLUSTER_HEADER + pillsHeight(shown, showToggle);
      sections.push({ id, band, total: all.length, pills: shown, hidden: all.length - shown.length, expanded: isOpen });
    }
    const id = `cl:${apMac}`;
    nodes.push({
      id,
      type: "cluster",
      position: { x: 0, y: 0 },
      width: CLUSTER_W,
      height,
      data: { sections, onToggle },
    });
    edges.push({ id: `ce:${id}`, source: apMac, target: id, type: "route", className: "cluster-edge", data: {} });
  }

  return { nodes, edges };
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
  },
  horizontal: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.layered.spacing.nodeNodeBetweenLayers": "200",
    "elk.spacing.nodeNode": "24",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  },
  radial: {
    "elk.algorithm": "radial",
    // Wide enough that a link label fits between two linked cards.
    "elk.spacing.nodeNode": "120",
    "elk.radial.compactor": "WEDGE_COMPACTION",
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
    children: nodes.map((n) => ({ id: n.id, width: n.width ?? AP_W, height: n.height ?? AP_H })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });

  let boxes = new Map<string, Box>((graph.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0, w: c.width ?? 0, h: c.height ?? 0 }]));
  let routes: Map<string, Point[]>;

  if (mode === "radial") {
    const root = nodes.find((n) => n.type === "ap" && (n.data as ApNodeData).ap.role === "root")?.id ?? nodes[0]?.id;
    boxes = spreadRadial(boxes, root, edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      label: e.type === "backhaul" ? backhaulLabel((e.data as BackhaulEdgeData).link).text : undefined,
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
