// Client-card sizing for the topology canvas: pill widths and section heights are
// measured up front so ELK lays the card out at its true size.

import type { Member } from "@/web/lib/corteca/types";
import type { Band, ClientPill, ClientSection, ClusterFlowNode, ClusterNodeData } from "@/web/lib/topologyFlow";
import { clientName, clientSignal } from "@/web/lib/clientFields";

export const CLUSTER_W = 232;
export const CLUSTER_COLLAPSE_AT = 6;
const CLUSTER_PAD = 12, CLUSTER_HEADER = 22, PILL_GAP = 6, SECTION_GAP = 12;
const PILL_H1 = 24, PILL_H2 = 38, PILL_MAX = CLUSTER_W - 2 * CLUSTER_PAD;
const CHAR_W = 7.2, PILL_CHROME = 40; // text-xs average glyph width; dot + gap + padding + border

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

/** A wired client's own node on the canvas: one line, sized to its name. */
export const WIRED_H = 32, WIRED_MIN_W = 112, WIRED_MAX_W = 240;
// 12px icon + 8px gap + 2×12px padding + 2×1px border, plus a few px so the name never truncates.
const WIRED_CHROME = 52;
export function wiredNodeWidth(m: Member): number {
  return Math.max(WIRED_MIN_W, Math.min(WIRED_MAX_W, Math.ceil(textWidth(clientName(m)) + WIRED_CHROME)));
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

/** One client card: a section per band (collapsing to "+N" past CLUSTER_COLLAPSE_AT), sized for ELK. */
export function clusterNode(
  owner: string,
  bands: Map<Band, Member[]>,
  expanded: Set<string>,
  onToggle: ClusterNodeData["onToggle"],
): ClusterFlowNode {
  const sections: ClientSection[] = [];
  let height = CLUSTER_PAD * 2;
  for (const band of BAND_ORDER) {
    const members = bands.get(band);
    if (!members?.length) continue;
    const id = `${owner}:${band}`;
    // Only collapsible sections can be "expanded" (avoids a stray "less" toggle).
    const isOpen = expanded.has(id) && members.length > CLUSTER_COLLAPSE_AT;
    const all = members.map(toPill).sort((a, b) => a.name.localeCompare(b.name));
    const shown = isOpen || all.length <= CLUSTER_COLLAPSE_AT ? all : all.slice(0, CLUSTER_COLLAPSE_AT - 1);
    const showToggle = shown.length < all.length || (isOpen && all.length > CLUSTER_COLLAPSE_AT);
    if (sections.length) height += SECTION_GAP;
    height += CLUSTER_HEADER + pillsHeight(shown, showToggle);
    sections.push({ id, band, total: all.length, pills: shown, hidden: all.length - shown.length, expanded: isOpen });
  }
  return { id: `cl:${owner}`, type: "cluster", position: { x: 0, y: 0 }, width: CLUSTER_W, height, data: { sections, onToggle } };
}
