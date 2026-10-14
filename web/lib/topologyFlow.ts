// Turns an McpNetwork into React Flow nodes/edges (AP cards, per-band client
// clusters, backhaul links) and lays them out top-down with ELK.

import type { Edge, Node } from "@xyflow/react";
import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";

// ── Sizes (must match the node components) ───────────────────────────────────

export const AP_W = 232, AP_H = 84;
export const CLUSTER_W = 232;
const CLUSTER_PAD = 12, CLUSTER_HEADER = 22, PILL_GAP = 6;
const PILL_H1 = 24, PILL_H2 = 38, PILL_MAX = CLUSTER_W - 2 * CLUSTER_PAD;
const CHAR_W = 6.4, PILL_CHROME = 30; // text-xs average glyph width + dot + padding
export const CLUSTER_COLLAPSE_AT = 6;

// ── Types ────────────────────────────────────────────────────────────────────

export type Quality = "good" | "fair" | "poor" | "unknown";
export type Band = "2.4 GHz" | "5 GHz" | "6 GHz" | "Wired" | "Other";

export interface ClientPill {
  id: string;
  name: string;
  signal: Quality | null;   // null = wired
  width: number;
  twoLines: boolean;
}

export interface ApNodeData extends Record<string, unknown> { ap: McpAccessPoint }
export interface ClusterNodeData extends Record<string, unknown> {
  band: Band;
  total: number;
  pills: ClientPill[];
  hidden: number;           // collapsed into "+N"
  expanded: boolean;
  onToggle: () => void;
}
export interface BackhaulEdgeData extends Record<string, unknown> { link: McpBackhaulLink }

export type ApFlowNode = Node<ApNodeData, "ap">;
export type ClusterFlowNode = Node<ClusterNodeData, "cluster">;
export type FlowNode = ApFlowNode | ClusterFlowNode;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function linkQuality(link: McpBackhaulLink): Quality {
  const q = link.quality;
  return q === "good" || q === "fair" || q === "poor" ? q : "unknown";
}

export const isEthernet = (link: McpBackhaulLink) => link.medium.includes("eth");

function clientBand(m: Member): Band {
  if (String(m.type ?? "").toLowerCase() === "ethernet") return "Wired";
  const f = Number(m.frequency ?? 0);
  if (f >= 2400 && f < 2500) return "2.4 GHz";
  if (f >= 4900 && f < 5900) return "5 GHz";
  if (f >= 5925) return "6 GHz";
  return "Other";
}

// Client signal uses the same three-step scale as the links.
function clientSignal(m: Member): Quality | null {
  if (String(m.type ?? "").toLowerCase() === "ethernet") return null;
  const s = Number((m as unknown as { signal?: number }).signal ?? m.rssi);
  if (!Number.isFinite(s) || s === 0) return "unknown";
  return s >= -65 ? "good" : s >= -75 ? "fair" : "poor";
}

function clientName(m: Member): string {
  const host = (m as unknown as { hostname?: string }).hostname;
  return (m.alias || host || m.id).trim();
}

function toPill(m: Member): ClientPill {
  const name = clientName(m);
  const natural = Math.ceil(name.length * CHAR_W + PILL_CHROME);
  return { id: m.id, name, signal: clientSignal(m), width: Math.min(PILL_MAX, natural), twoLines: natural > PILL_MAX };
}

// Greedy row packing — mirrors the cluster's flex-wrap so ELK gets a true height.
export function clusterHeight(pills: ClientPill[], showMore: boolean): number {
  const items = pills.map((p) => ({ w: p.width, h: p.twoLines ? PILL_H2 : PILL_H1 }));
  if (showMore) items.push({ w: 44, h: PILL_H1 });
  let rows = 0, rowW = 0, rowH = 0, total = 0;
  for (const it of items) {
    if (rowW > 0 && rowW + PILL_GAP + it.w > PILL_MAX) { total += rowH; rows++; rowW = 0; rowH = 0; }
    rowW += (rowW > 0 ? PILL_GAP : 0) + it.w;
    rowH = Math.max(rowH, it.h);
  }
  if (rowW > 0) { total += rowH; rows++; }
  return CLUSTER_PAD * 2 + CLUSTER_HEADER + total + PILL_GAP * Math.max(0, rows - 1);
}

const BAND_ORDER: Band[] = ["6 GHz", "5 GHz", "2.4 GHz", "Wired", "Other"];

// ── Graph ────────────────────────────────────────────────────────────────────

export function buildFlowGraph(
  network: McpNetwork,
  expanded: Set<string>,
  onToggle: (clusterId: string) => void,
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
    for (const band of BAND_ORDER) {
      const members = bands.get(band);
      if (!members?.length) continue;
      const id = `cl:${apMac}:${band}`;
      const isOpen = expanded.has(id);
      const all = members.map(toPill).sort((a, b) => a.name.localeCompare(b.name));
      const shown = isOpen || all.length <= CLUSTER_COLLAPSE_AT ? all : all.slice(0, CLUSTER_COLLAPSE_AT - 1);
      const hidden = all.length - shown.length;
      const showToggle = hidden > 0 || (isOpen && all.length > CLUSTER_COLLAPSE_AT);
      nodes.push({
        id,
        type: "cluster",
        position: { x: 0, y: 0 },
        width: CLUSTER_W,
        height: clusterHeight(shown, showToggle),
        data: { band, total: all.length, pills: shown, hidden, expanded: isOpen, onToggle: () => onToggle(id) },
      });
      edges.push({ id: `ce:${id}`, source: apMac, target: id, type: "smoothstep", className: "cluster-edge" });
    }
  }

  return { nodes, edges };
}

// ── Layout ───────────────────────────────────────────────────────────────────

export async function layoutFlowGraph(nodes: FlowNode[], edges: Edge[]): Promise<FlowNode[]> {
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
      "elk.spacing.nodeNode": "28",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    },
    children: nodes.map((n) => ({ id: n.id, width: n.width ?? AP_W, height: n.height ?? AP_H })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const pos = new Map((graph.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
}
