// Edge routes, label placement and overlap checks for the topology canvas.
// Guarantees used by layoutFlowGraph(): no edge runs under a card it doesn't
// connect, and no backhaul label covers a card or another label.

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

const LABEL_H = 22, LABEL_CHAR_W = 6.4, LABEL_PAD = 26; // text-[11px] px-2.5 + border
// A stacked label ("6 GHz" over "-57 dBm · 2.6 Gbps"): the small top line adds 14 px, each further line
// (an MLO backhaul's bands) 16 px.
const LABEL_TOP_H = 14, LABEL_LINE_H = 16;
export const LABEL_GAP = 10; // clear space kept between a label and the card it points at

/** Label size; a "\n" in the text stacks it on several lines (width = the longest line). */
export function labelSize(text: string): { w: number; h: number } {
  const lines = text.split("\n");
  const chars = Math.max(...lines.map((l) => l.length));
  const extra = lines.length > 1 ? LABEL_TOP_H + (lines.length - 2) * LABEL_LINE_H : 0;
  return { w: Math.ceil(chars * LABEL_CHAR_W + LABEL_PAD), h: LABEL_H + extra };
}

export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

function boxesOverlap(a: Box, b: Box, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/** Point where the ray from the box centre toward `toward` leaves the box. */
export function exitPoint(b: Box, toward: Point): Point {
  const c = center(b);
  const dx = toward.x - c.x, dy = toward.y - c.y;
  if (!dx && !dy) return c;
  const t = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

// Liang–Barsky: does segment p→q pass through the (padded) box?
function segmentHitsBox(p: Point, q: Point, b: Box, pad = 0): boolean {
  const x0 = b.x - pad, x1 = b.x + b.w + pad, y0 = b.y - pad, y1 = b.y + b.h + pad;
  const dx = q.x - p.x, dy = q.y - p.y;
  let t0 = 0, t1 = 1;
  for (const [pk, qk] of [[-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y]]) {
    if (pk === 0) { if (qk < 0) return false; continue; }
    const r = qk / pk;
    if (pk < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t1 - t0 > 1e-6;
}

/**
 * Where a backhaul label sits on its route. Layered layouts: on the last segment,
 * just short of the child card (siblings' last segments never share space).
 * Radial: the middle of the straight run between the two cards.
 */
export function labelBox(points: Point[], text: string, radial: boolean): Box {
  const { w, h } = labelSize(text);
  const a = points.at(-2) ?? points[0], b = points.at(-1) ?? points[0];
  let c: Point;
  if (radial) {
    c = { x: (points[0].x + b.x) / 2, y: (points[0].y + b.y) / 2 };
  } else {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const extent = Math.abs(ux) * w + Math.abs(uy) * h; // label size along the segment
    const back = Math.min(len / 2, extent / 2 + LABEL_GAP);
    c = { x: b.x - ux * back, y: b.y - uy * back };
  }
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

export interface GeoEdge { id: string; source: string; target: string; points: Point[]; label?: string }

/** Human-readable list of overlaps; empty when the layout is clean. */
export function layoutProblems(boxes: Map<string, Box>, edges: GeoEdge[], radial: boolean): string[] {
  const problems: string[] = [];
  const labels: { id: string; box: Box }[] = [];
  for (const e of edges) {
    for (let i = 0; i + 1 < e.points.length; i++) {
      for (const [id, b] of boxes) {
        if (id === e.source || id === e.target) continue;
        if (segmentHitsBox(e.points[i], e.points[i + 1], b, 2)) problems.push(`edge ${e.id} runs under ${id}`);
      }
    }
    if (e.label) {
      const lb = labelBox(e.points, e.label, radial);
      for (const [id, b] of boxes) if (boxesOverlap(lb, b)) problems.push(`label of ${e.id} covers ${id}`);
      for (const other of labels) if (boxesOverlap(lb, other.box, 2)) problems.push(`label of ${e.id} overlaps label of ${other.id}`);
      labels.push({ id: e.id, box: lb });
    }
  }
  return [...new Set(problems)];
}

/** Straight centre-to-centre route, trimmed to the two cards' borders. */
export function straightRoute(a: Box, b: Box): Point[] {
  return [exitPoint(a, center(b)), exitPoint(b, center(a))];
}

/**
 * ELK's radial layout can leave linked cards nearly touching, hiding the link
 * and its label. Scale every card's distance from the root's centre until the
 * layout is clean (or a cap is reached), keeping the same shape.
 */
export function spreadRadial(
  boxes: Map<string, Box>,
  rootId: string,
  edges: Omit<GeoEdge, "points">[],
): Map<string, Box> {
  const root = boxes.get(rootId);
  if (!root) return boxes;
  const rc = center(root);
  const scaled = (s: number) => {
    const out = new Map<string, Box>();
    for (const [id, b] of boxes) {
      const c = center(b);
      out.set(id, { ...b, x: rc.x + (c.x - rc.x) * s - b.w / 2, y: rc.y + (c.y - rc.y) * s - b.h / 2 });
    }
    return out;
  };
  for (let s = 1; s <= 4; s += 0.1) {
    const next = scaled(s);
    const routed = edges.map((e) => ({ ...e, points: straightRoute(next.get(e.source)!, next.get(e.target)!) }));
    if (layoutProblems(next, routed, true).length === 0) return next;
  }
  return scaled(4);
}
