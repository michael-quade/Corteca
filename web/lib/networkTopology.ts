// ── Raw API shapes ────────────────────────────────────────────────────────────

export interface RawTopoNode {
  device_id?: string;
  depth?: number;
  children?: unknown[];        // string MAC refs OR nested objects
  [key: string]: unknown;
}

export interface RawMeshAp {
  id?: string;                 // serial e.g. "ALCLFE3DC8FD"
  macaddress?: string;         // lowercase colon: "60:98:49:ff:a4:a0"
  role?: string;               // "root" | "beacon"
  status?: string;             // "online" | "offline"
  deviceIndex?: number;
  ManufacturerModel?: string;
  [key: string]: unknown;
}

// ── Normalised tree ───────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  label: string;
  model: string;
  online: boolean;
  isRoot: boolean;
  children: TreeNode[];
}

export interface NodePosition { x: number; y: number }

// ── Layout constants ──────────────────────────────────────────────────────────

export const CANVAS_W = 900;
export const LEVEL_H  = 180;
export const PAD_TOP  = 90;

// ── MAC normalisation ─────────────────────────────────────────────────────────

// "60:98:49:ff:a4:a0" → "60-98-49-FF-A4-A0"
function normalizeMac(mac: string): string {
  if (!mac) return '';
  return mac.replace(/:/g, '-').toUpperCase();
}

// ── Device config model name ──────────────────────────────────────────────────

// "Nokia WiFi Beacon 19.1" → "Beacon 19.1"
function parseModelLabel(raw: string): string {
  return raw.replace(/^nokia\s+wifi\s+/i, '').replace(/^nokia\s+/i, '').trim() || raw;
}

function configModelLabel(configs: Record<string, unknown>, deviceId: string): string | null {
  const cfg = configs[deviceId];
  if (!cfg || typeof cfg !== 'object') return null;
  const val = (cfg as Record<string, unknown>)['Device.DeviceInfo.ModelName'];
  return val ? parseModelLabel(String(val)) : null;
}

// ── Mesh AP info map ──────────────────────────────────────────────────────────

interface ApInfo { mac: string; serial: string; label: string; model: string; online: boolean; isRoot: boolean }

function buildMeshApMaps(mesh: unknown): { byMac: Map<string, ApInfo>; bySerial: Map<string, ApInfo> } {
  const byMac = new Map<string, ApInfo>();
  const bySerial = new Map<string, ApInfo>();
  if (!mesh || typeof mesh !== 'object') return { byMac, bySerial };
  const aps = (mesh as Record<string, unknown>).aps;
  if (!Array.isArray(aps)) return { byMac, bySerial };

  for (const ap of aps as RawMeshAp[]) {
    const serial  = String(ap.id ?? '');
    const mac     = normalizeMac(String(ap.macaddress ?? ''));
    const role    = String(ap.role ?? '').toLowerCase();
    const isRoot  = role === 'root';
    const label   = isRoot ? 'Gateway' : `Beacon ${ap.deviceIndex ?? ''}`.trim();
    const model   = String(ap.ManufacturerModel ?? ap.model ?? 'Access Point');
    const online  = String(ap.status ?? '').toLowerCase() === 'online' || ap['X_ALU-COM_Online'] === true;
    const info: ApInfo = { mac, serial, label, model, online, isRoot };
    if (mac)    byMac.set(mac, info);
    if (serial) bySerial.set(serial, info);
  }
  return { byMac, bySerial };
}

// ── Tree building ─────────────────────────────────────────────────────────────

export function buildTree(
  topology: unknown,
  networks: unknown,
  mesh: unknown,
  configs: Record<string, unknown>,
  rootId: string
): TreeNode {
  const { byMac } = buildMeshApMaps(mesh);

  function info(id: string): Pick<TreeNode, 'label' | 'model' | 'online'> {
    const cfgLabel = configModelLabel(configs, id);
    const m = byMac.get(id);
    // label: config model name > mesh ManufacturerModel > fallback
    const label = cfgLabel ?? (m ? parseModelLabel(m.model) : null) ?? id;
    const model = m?.model ?? 'Access Point';
    const online = m?.online ?? false;
    return { label, model, online };
  }

  // Collect all topology objects into a flat list (children may be string refs)
  const flat: RawTopoNode[] = [];
  function collect(raw: unknown) {
    if (!raw || typeof raw !== 'object') return;
    if (Array.isArray(raw)) { (raw as unknown[]).forEach(collect); return; }
    const n = raw as RawTopoNode;
    flat.push(n);
    (n.children ?? []).forEach((c) => { if (c && typeof c === 'object') collect(c); });
  }
  collect(topology);
  // Also collect from networks (same shape)
  collect(networks);

  // Deduplicate by device_id, prefer topology entries
  const byId = new Map<string, RawTopoNode>();
  for (const n of flat) { const id = String(n.device_id ?? ''); if (id) byId.set(id, n); }

  // Root: depth=0, or device_id matches rootId, or first entry
  const rawRoot =
    [...byId.values()].find((n) => n.depth === 0) ??
    byId.get(rootId) ??
    flat[0] ?? null;

  if (!rawRoot) {
    return { id: rootId, ...info(rootId), isRoot: true, children: [] };
  }

  function makeNode(raw: RawTopoNode, visited = new Set<string>()): TreeNode {
    const id = String(raw.device_id ?? rootId);
    if (visited.has(id)) return { id, ...info(id), isRoot: id === rootId, children: [] };
    const next = new Set(visited).add(id);

    const children: TreeNode[] = (raw.children ?? []).map((c) => {
      if (typeof c === 'string') {
        const childRaw = byId.get(c) ?? { device_id: c };
        return makeNode(childRaw, next);
      }
      if (c && typeof c === 'object') return makeNode(c as RawTopoNode, next);
      return null;
    }).filter((n): n is TreeNode => n !== null);

    return { id, ...info(id), isRoot: id === rootId, children };
  }

  return makeNode(rawRoot);
}

// ── Layout ────────────────────────────────────────────────────────────────────

function countLeaves(n: TreeNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
}

export function buildPositions(
  node: TreeNode, depth: number, x0: number, x1: number,
  out: Map<string, NodePosition>
) {
  out.set(node.id, { x: (x0 + x1) / 2, y: PAD_TOP + depth * LEVEL_H });
  if (!node.children.length) return;
  const total = countLeaves(node);
  let cursor = x0;
  for (const child of node.children) {
    const w = (countLeaves(child) / total) * (x1 - x0);
    buildPositions(child, depth + 1, cursor, cursor + w, out);
    cursor += w;
  }
}

// ── Mesh link data extraction ─────────────────────────────────────────────────

export interface LinkData {
  medium: string;      // "eth" | "wifi" | ""
  band?: string;       // "2.4GHz" | "5GHz" | "6GHz"
  channel?: number;
  rssi?: number;       // dBm (negative)
  snr?: number;        // dB
  rxRate?: number;     // Mbps downlink
  txRate?: number;     // Mbps uplink
  linkSpeed?: number;  // Mbps, wired only
}

function num(l: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) { const v = l[k]; if (v !== undefined && v !== null) return Number(v); }
  return undefined;
}

export function buildLinkDataMap(mesh: unknown): Map<string, LinkData> {
  const map = new Map<string, LinkData>();
  if (!mesh || typeof mesh !== 'object') return map;
  const { bySerial } = buildMeshApMaps(mesh);
  const links = Array.isArray((mesh as Record<string,unknown>).links)
    ? ((mesh as Record<string,unknown>).links as unknown[]) : [];

  for (const link of links) {
    if (typeof link !== 'object' || !link) continue;
    const l = link as Record<string, unknown>;
    const medium = String(l.medium ?? '').toLowerCase();
    const eps = Array.isArray(l.endpoints) ? (l.endpoints as unknown[]) : [];
    if (eps.length < 2) continue;
    const macs = eps.map((ep) => {
      const e = ep as Record<string, unknown>;
      return bySerial.get(String(e.id ?? ''))?.mac ?? normalizeMac(String(e.macaddress ?? ''));
    }).filter(Boolean);
    if (macs.length < 2) continue;
    const data: LinkData = {
      medium,
      band:      l.band ? String(l.band) : (l.radioband ? String(l.radioband) : undefined),
      channel:   num(l, 'channel', 'operating_channel'),
      rssi:      num(l, 'rssi', 'signal', 'signal_strength', 'rss'),
      snr:       num(l, 'snr'),
      rxRate:    num(l, 'rx_rate', 'rxrate', 'rxRate', 'data_rate', 'datarate'),
      txRate:    num(l, 'tx_rate', 'txrate', 'txRate'),
      linkSpeed: num(l, 'speed', 'rate', 'bandwidth', 'link_speed'),
    };
    map.set(`${macs[0]}:${macs[1]}`, data);
    map.set(`${macs[1]}:${macs[0]}`, data);
  }
  return map;
}

export function linkTip(ld: LinkData | undefined): [string, string] {
  const isEth = (ld?.medium ?? '').includes('eth');
  if (isEth) {
    const s = ld?.linkSpeed;
    return ['Ethernet Backhaul', s ? (s >= 1000 ? `${s / 1000} Gbps` : `${s} Mbps`) : 'Wired link'];
  }
  const parts = [
    ld?.band,
    ld?.channel != null ? `Ch ${ld.channel}` : null,
    ld?.rssi    != null ? `RSSI ${ld.rssi} dBm` : null,
    ld?.snr     != null ? `SNR ${ld.snr} dB` : null,
    (ld?.rxRate ?? 0) > 0 ? `↓${ld!.rxRate} Mbps` : null,
    (ld?.txRate ?? 0) > 0 ? `↑${ld!.txRate} Mbps` : null,
  ].filter(Boolean);
  return ['WiFi Backhaul', parts.join(' · ') || 'WiFi link'];
}

// ── Tree traversal helpers ────────────────────────────────────────────────────

export function collectEdges(node: TreeNode, out: Array<{ from: string; to: string }> = []) {
  for (const child of node.children) { out.push({ from: node.id, to: child.id }); collectEdges(child, out); }
  return out;
}

export function flatNodes(node: TreeNode, out: TreeNode[] = []): TreeNode[] {
  out.push(node); node.children.forEach((c) => flatNodes(c, out)); return out;
}

export function treeDepth(node: TreeNode): number {
  if (!node.children.length) return 0;
  return 1 + Math.max(...node.children.map(treeDepth));
}

export function buildBoundingBox(positions: Map<string, NodePosition>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { x, y } of positions.values()) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}
