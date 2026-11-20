// Live AP counts per home from Corteca's mesh (`/homehub/networks/{id}/mesh`) — what the console's
// network map draws. The deployment report is an inventory: it keeps devices that left the mesh and
// its online flag can be stale (A8-FB-40-AE-C1-F3, 2026-11-20: report 8 devices / 5 online, mesh and
// console 6 / 4), so the Network Map's "Gateway online" view counts from the mesh.
// Client + server safe.

export interface MeshCount {
  /** APs in the mesh (gateway + Beacons, online or not) — the console's WiFi points. */
  aps: number;
  onlineAps: number;
  gatewayOnline: boolean;
  /** Root AP's model as the mesh reports it ("" for old Beacons that report none). */
  gatewayModel: string;
}

/** Ids per request to the mesh-counts route, and requests in flight at once. */
export const MESH_BATCH = 20;
export const MESH_PARALLEL = 3;

/** null when the payload has no APs (no mesh for this network). */
export function parseMeshCount(json: unknown): MeshCount | null {
  const aps = (json as { aps?: unknown })?.aps;
  if (!Array.isArray(aps) || aps.length === 0) return null;
  const list = aps.filter((a): a is Record<string, unknown> => !!a && typeof a === "object");
  const isOnline = (a: Record<string, unknown>) => String(a.status ?? "").toLowerCase() === "online";
  const root = list.find((a) => a.role === "root");
  const model = root ? String(root.model ?? root.ManufacturerModel ?? "").trim() : "";
  return {
    aps: list.length,
    onlineAps: list.filter(isOnline).length,
    gatewayOnline: root ? isOnline(root) : list.some(isOnline),
    gatewayModel: model,
  };
}

export const isMeshCount = (v: unknown): v is MeshCount =>
  !!v && typeof v === "object" &&
  typeof (v as MeshCount).aps === "number" && typeof (v as MeshCount).onlineAps === "number" &&
  typeof (v as MeshCount).gatewayOnline === "boolean";
