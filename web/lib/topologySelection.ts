// Selection, path highlighting, client filters, search, keyboard order and
// URL (de)serialisation for the MCP network visualizer.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import { clientBand, clientName, clientSignalDbm, type Band, type LayoutMode } from "@/web/lib/topologyFlow";

export type SelectionKind = "ap" | "client" | "link";
/** `link` ids are the child AP's MAC (each AP has at most one backhaul parent). */
export interface Selection { kind: SelectionKind; id: string }

export interface ClientFilters { bands: Band[]; ssids: string[]; weak: boolean }
export const EMPTY_FILTERS: ClientFilters = { bands: [], ssids: [], weak: false };
export const WEAK_SIGNAL_DBM = -70;

export const filtersActive = (f: ClientFilters) => f.bands.length > 0 || f.ssids.length > 0 || f.weak;

export const memberSsid = (m: Member) => String((m as unknown as { ssid?: string }).ssid ?? "");

export function clientMatches(m: Member, f: ClientFilters): boolean {
  if (f.bands.length && !f.bands.includes(clientBand(m))) return false;
  if (f.ssids.length && !f.ssids.includes(memberSsid(m))) return false;
  if (f.weak) {
    const s = clientSignalDbm(m);
    if (s == null || s >= WEAK_SIGNAL_DBM) return false;
  }
  return true;
}

export function ssidsOf(network: McpNetwork): string[] {
  return [...new Set(network.members.filter((m) => m.connected).map(memberSsid).filter(Boolean))].sort();
}

// ── Path highlighting ────────────────────────────────────────────────────────

export interface Highlight { nodes: Set<string>; edges: Set<string> }

function parentMap(network: McpNetwork): Map<string, string> {
  return new Map(network.backhaul.map((l) => [l.childMac, l.parentMac]));
}

// AP → gateway chain: node ids plus the backhaul edge ids between them.
function chainToGateway(apMac: string, parents: Map<string, string>, out: Highlight) {
  let cur: string | undefined = apMac;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.nodes.add(cur);
    const parent = parents.get(cur);
    if (parent) out.edges.add(`bh:${parent}:${cur}`);
    cur = parent;
  }
}

export function highlightFor(network: McpNetwork, sel: Selection | null): Highlight | null {
  if (!sel) return null;
  const parents = parentMap(network);
  const out: Highlight = { nodes: new Set(), edges: new Set() };
  if (sel.kind === "client") {
    const ap = network.members.find((m) => m.id === sel.id)?.device_id;
    if (!ap) return null;
    out.nodes.add(`cl:${ap}`);
    out.edges.add(`ce:cl:${ap}`);
    chainToGateway(ap, parents, out);
  } else if (sel.kind === "ap") {
    out.nodes.add(`cl:${sel.id}`);
    out.edges.add(`ce:cl:${sel.id}`);
    chainToGateway(sel.id, parents, out);
  } else {
    const parent = parents.get(sel.id);
    if (!parent) return null;
    out.nodes.add(parent).add(sel.id);
    out.edges.add(`bh:${parent}:${sel.id}`);
  }
  return out;
}

/** React Flow node id that represents a selection on the canvas (for panning to it). */
export function anchorNodeId(network: McpNetwork, sel: Selection): string | null {
  if (sel.kind === "client") {
    const ap = network.members.find((m) => m.id === sel.id)?.device_id;
    return ap ? `cl:${ap}` : null;
  }
  return sel.id;
}

// ── Search & keyboard order ──────────────────────────────────────────────────

const normMac = (s: string) => s.toUpperCase().replace(/[:\-\s]/g, "");

export function searchClients(network: McpNetwork, query: string, limit = 8): Member[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qMac = normMac(q);
  return network.members
    .filter((m) => m.connected)
    .filter((m) =>
      clientName(m).toLowerCase().includes(q) ||
      (qMac.length >= 4 && normMac(m.id).includes(qMac)) ||
      (m.ipv4 ?? "").includes(q)
    )
    .slice(0, limit);
}

/** APs in tree order (gateway first, depth-first), each followed by its connected clients. */
export function navigationOrder(network: McpNetwork): Selection[] {
  const children = new Map<string, string[]>();
  for (const l of network.backhaul) children.set(l.parentMac, [...(children.get(l.parentMac) ?? []), l.childMac]);
  const root = network.aps.find((a) => a.role === "root")?.mac ?? network.aps[0]?.mac;
  const order: Selection[] = [];
  const visit = (mac: string, seen: Set<string>) => {
    if (seen.has(mac)) return;
    seen.add(mac);
    order.push({ kind: "ap", id: mac });
    network.members
      .filter((m) => m.connected && m.device_id === mac)
      .sort((a, b) => clientName(a).localeCompare(clientName(b)))
      .forEach((m) => order.push({ kind: "client", id: m.id }));
    (children.get(mac) ?? []).forEach((c) => visit(c, seen));
  };
  const seen = new Set<string>();
  if (root) visit(root, seen);
  network.aps.forEach((a) => visit(a.mac, seen)); // any AP the tree didn't reach
  return order;
}

// ── URL state ────────────────────────────────────────────────────────────────

export interface Viewport { x: number; y: number; zoom: number }

export interface ViewState {
  network: string | null;
  selection: Selection | null;
  filters: ClientFilters;
  layout: LayoutMode;
  viewport: Viewport | null;
}

const BAND_KEYS: Record<Band, string> = { "6 GHz": "6", "5 GHz": "5", "2.4 GHz": "2.4", Wired: "wired", Other: "other" };
const BAND_BY_KEY = Object.fromEntries(Object.entries(BAND_KEYS).map(([b, k]) => [k, b as Band]));
const LAYOUTS: LayoutMode[] = ["tree", "horizontal", "radial"];

export function parseViewState(search: string): ViewState {
  const p = new URLSearchParams(search);
  const [kind, ...rest] = (p.get("sel") ?? "").split(":");
  const selId = rest.join(":");
  const v = (p.get("v") ?? "").split(",").map(Number);
  const layout = p.get("layout") as LayoutMode | null;
  return {
    network: p.get("network"),
    selection: (kind === "ap" || kind === "client" || kind === "link") && selId ? { kind, id: selId } : null,
    filters: {
      bands: (p.get("band") ?? "").split(",").map((k) => BAND_BY_KEY[k]).filter(Boolean),
      ssids: p.getAll("ssid"),
      weak: p.get("weak") === "1",
    },
    layout: layout && LAYOUTS.includes(layout) ? layout : "tree",
    viewport: v.length === 3 && v.every(Number.isFinite) ? { x: v[0], y: v[1], zoom: v[2] } : null,
  };
}

export function serializeViewState(s: ViewState): string {
  const p = new URLSearchParams();
  if (s.network) p.set("network", s.network);
  if (s.selection) p.set("sel", `${s.selection.kind}:${s.selection.id}`);
  if (s.filters.bands.length) p.set("band", s.filters.bands.map((b) => BAND_KEYS[b]).join(","));
  s.filters.ssids.forEach((ssid) => p.append("ssid", ssid));
  if (s.filters.weak) p.set("weak", "1");
  if (s.layout !== "tree") p.set("layout", s.layout);
  if (s.viewport) p.set("v", [s.viewport.x, s.viewport.y].map(Math.round).concat(+s.viewport.zoom.toFixed(3)).join(","));
  const q = p.toString();
  return q ? `?${q}` : "";
}
