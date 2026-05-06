import type { TreeNode, NodePosition } from "./networkTopology";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeviceNode {
  id: string;
  label: string;
  apId: string;
  type: string;
  ipv4?: string; wired: boolean;
}

// ── Member filtering ──────────────────────────────────────────────────────────

const BEACON_RE = /nokia\s+wifi\s+(beacon|gateway|extender)/i;

export function filterConnectedDevices(raw: unknown): DeviceNode[] {
  const arr = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.content;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((m) => {
      if (typeof m !== "object" || !m) return false;
      const n = m as Record<string, unknown>;
      if (!n.connected) return false;
      return !BEACON_RE.test(String(n.alias ?? "")) && !BEACON_RE.test(String(n.hostname ?? ""));
    })
    .map((m) => {
      const n = m as Record<string, unknown>;
      const alias    = String(n.alias    ?? "").trim();
      const hostname = String(n.hostname ?? "").trim();
      return {
        id:    String(n.id ?? n.mac ?? ""),
        label: (alias || hostname || "Device").slice(0, 18),
        apId:  String(n.device_id ?? ""),
        type:  String(n.device_category ?? n.category ?? n.device_type ?? "OTHER"),
        ipv4:  n.ipv4 ? String(n.ipv4) : undefined,
        wired: String(n.type ?? "").toLowerCase() === "ethernet" || n.wireless === false || n.wireless === "false" || String(n.connection_type ?? "").toLowerCase() === "ethernet" || String(n.layer1_interface ?? "").toLowerCase().includes("ethernet"),
      };
    })
    .filter((d) => d.id);
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function buildParentMap(node: TreeNode, map: Map<string, string> = new Map()) {
  node.children.forEach((c) => { map.set(c.id, node.id); buildParentMap(c, map); });
  return map;
}

function getApEdges(node: TreeNode, out: Array<{ from: string; to: string }> = []) {
  for (const c of node.children) { out.push({ from: node.id, to: c.id }); getApEdges(c, out); }
  return out;
}

// ── Force-directed layout ─────────────────────────────────────────────────────
// APs are fixed. Devices repel everything and spring toward their parent AP.
// Additionally, devices are repelled away from every AP–AP edge segment so they
// never drift into backhaul connection lanes.

interface FNode { id: string; x: number; y: number; vx: number; vy: number; fixed: boolean }

function forceSimulation(
  devices: DeviceNode[],
  apPos: Map<string, NodePosition>,
  initial: Map<string, NodePosition>,
  apEdges: Array<{ from: string; to: string }>,
): Map<string, NodePosition> {
  if (devices.length === 0) return initial;

  const nodes = new Map<string, FNode>();
  for (const [id, p] of apPos) nodes.set(id, { id, ...p, vx: 0, vy: 0, fixed: true });
  devices.forEach((d, i) => {
    const p = initial.get(d.id) ?? apPos.get(d.apId) ?? { x: 0, y: 0 };
    nodes.set(d.id, { id: d.id, x: p.x + (i % 7 - 3) * 10, y: p.y + (Math.floor(i / 7) - 1) * 10, vx: 0, vy: 0, fixed: false });
  });

  const all = [...nodes.values()];
  const K_REP     = 8500;   // node-to-node repulsion
  const K_EDGE    = 20000;  // repulsion from AP–AP edge segments
  const EDGE_DIST = 80;     // buffer distance around each backhaul edge
  const K_SPR     = 0.055;  // spring: device → parent AP
  const LINK_LEN  = 105;    // target device–AP distance
  const DAMP      = 0.55;
  const ITERS     = 320;

  for (let iter = 0; iter < ITERS; iter++) {
    const alpha = 1 - iter / ITERS;  // cooling

    for (const n of all) { n.vx = 0; n.vy = 0; }

    // Node-to-node repulsion
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const na = all[a], nb = all[b];
        const dx = nb.x - na.x || 0.01, dy = nb.y - na.y || 0.01;
        const d2 = dx * dx + dy * dy;
        if (d2 > 80000) continue;
        const d = Math.sqrt(d2);
        const f = K_REP / d2;
        if (!na.fixed) { na.vx -= f * dx / d; na.vy -= f * dy / d; }
        if (!nb.fixed) { nb.vx += f * dx / d; nb.vy += f * dy / d; }
      }
    }

    // Repulsion away from AP–AP edge segments
    for (const { from, to } of apEdges) {
      const a = nodes.get(from), b = nodes.get(to);
      if (!a || !b) continue;
      const edx = b.x - a.x, edy = b.y - a.y;
      const len2 = edx * edx + edy * edy || 1;
      for (const n of all) {
        if (n.fixed) continue;
        const t = Math.max(0, Math.min(1, ((n.x - a.x) * edx + (n.y - a.y) * edy) / len2));
        const cpx = a.x + t * edx, cpy = a.y + t * edy;
        const ex = n.x - cpx, ey = n.y - cpy;
        const dist = Math.sqrt(ex * ex + ey * ey) || 0.01;
        if (dist < EDGE_DIST) {
          const f = K_EDGE / (dist * dist);
          n.vx += f * ex / dist;
          n.vy += f * ey / dist;
        }
      }
    }

    // Spring: device → parent AP at target distance
    for (const d of devices) {
      const n = nodes.get(d.id)!, ap = nodes.get(d.apId);
      if (!ap) continue;
      const dx = ap.x - n.x, dy = ap.y - n.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = K_SPR * (dist - LINK_LEN);
      n.vx += f * dx / dist;
      n.vy += f * dy / dist;
    }

    for (const n of all) {
      if (n.fixed) continue;
      n.x += n.vx * DAMP * alpha;
      n.y += n.vy * DAMP * alpha;
    }
  }

  const out = new Map<string, NodePosition>();
  for (const d of devices) {
    const n = nodes.get(d.id);
    if (n) out.set(d.id, { x: n.x, y: n.y });
  }
  return out;
}

// ── Public: compute all device positions ──────────────────────────────────────

export function computeDevicePositions(
  devices: DeviceNode[],
  apPositions: Map<string, NodePosition>,
  tree: TreeNode,
): Map<string, NodePosition> {
  const parentOf = buildParentMap(tree);
  const apEdges  = getApEdges(tree);

  const byAp = new Map<string, DeviceNode[]>();
  for (const d of devices) { const a = byAp.get(d.apId) ?? []; a.push(d); byAp.set(d.apId, a); }

  // Arc starting positions — root points UP, others point away from their parent
  const initial = new Map<string, NodePosition>();
  for (const [apId, apDevices] of byAp) {
    const ap = apPositions.get(apId);
    if (!ap) continue;
    const n = apDevices.length;
    const parentPos = apPositions.get(parentOf.get(apId) ?? "");

    // Root AP: direct devices upward (-π/2); children: away from parent
    const baseAngle = parentPos
      ? Math.atan2(ap.y - parentPos.y, ap.x - parentPos.x)
      : -Math.PI / 2;

    // Root uses wider spread (up to π) so many devices fan above it cleanly
    const spread = parentPos
      ? Math.min(Math.PI * 0.9, Math.max(0.5, n * 0.42))
      : Math.min(Math.PI,       Math.max(0.5, n * 0.38));

    const radius = Math.max(95, 70 + n * 8);
    apDevices.forEach((d, i) => {
      const angle = n === 1 ? baseAngle : baseAngle - spread / 2 + (i / (n - 1)) * spread;
      initial.set(d.id, { x: ap.x + radius * Math.cos(angle), y: ap.y + radius * Math.sin(angle) });
    });
  }

  return forceSimulation(devices, apPositions, initial, apEdges);
}

// ── Device accent color ───────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  PHONE: "#6366f1", LAPTOP: "#0ea5e9", TABLET: "#06b6d4",
  TV: "#f97316", GAMING: "#ef4444", SPEAKER: "#a855f7",
  CAMERA: "#84cc16", APPLIANCE: "#78716c",
};
export const deviceColor = (t: string) => TYPE_COLOR[t.toUpperCase()] ?? "#9ca3af";
