import type { MeshCount } from "./meshCounts";

// Per-home WiFi device counts from the fleet deployment report (one CSV row per managed
// WiFi device; a home's rows share its "Home WiFi ID", the root gateway's MAC).

export type GatewayKind = "beacon" | "ont" | "fwa" | "other" | "unknown";

export const GATEWAY_KINDS: GatewayKind[] = ["beacon", "ont", "fwa", "other", "unknown"];

export const GATEWAY_KIND_META: Record<GatewayKind, { label: string; hint: string }> = {
  beacon: { label: "Beacon", hint: "A Nokia WiFi Beacon is the home's gateway (primary RG)" },
  ont: { label: "ONT", hint: "A fiber ONT is the gateway: model XS-… or G-… (also older g240wg-style names)" },
  fwa: { label: "Fixed wireless", hint: "A Nokia FastMile fixed wireless (4G/5G) gateway or receiver: model FastMile…" },
  other: { label: "Other gateway", hint: "Operator-branded and third-party routers" },
  unknown: { label: "Unknown", hint: "The report has no gateway row or no model name for this home" },
};

export interface HomeApRow {
  homeId: string;
  accountName: string;
  customerId: string;
  gatewayModel: string;
  kind: GatewayKind;
  /** WiFi devices (gateway + Beacons) the report lists for the home. */
  aps: number;
  onlineAps: number;
  /** Gateway online (any device online when the report has no gateway row). */
  online: boolean;
  /** Where aps / onlineAps / online come from: the deployment report, or Corteca's live mesh. */
  source: "report" | "mesh";
}

/**
 * ONT mnemonics start with XS- or G- (old ONTs report "g240wg", "g140wh"); fixed wireless with
 * FastMile ("FastMile 5G Gateway 7", "FastMile5GGateway7.1prpl"); Beacons say "Beacon" or start with "ha" (ha020wb, ha030wb, ha0336ga).
 */
export function gatewayKind(model: string): GatewayKind {
  const m = model.trim();
  if (!m) return "unknown";
  if (/^(xs|g)-/i.test(m) || /^g\d{3}w/i.test(m)) return "ont";
  if (/^fastmile/i.test(m)) return "fwa";
  if (/beacon/i.test(m) || /^ha/i.test(m)) return "beacon";
  return "other";
}

const isOnline = (r: Record<string, string>) => r["Online status"]?.toLowerCase() === "true";

/**
 * Fields that show a row is a real managed device. Some rows carry only MAC, Home WiFi ID and
 * online status (12 on demo2, 2026-11-20; e.g. 40-48-6E-FF-E9-B0 listed under a 4-Beacon home that
 * MCP shows with 4 APs) — Corteca stubs, not WiFi devices, so they aren't counted.
 */
const DEVICE_FIELDS = ["Model Name", "Serial Number", "Firmware version", "Product Code", "Work Role", "USP end point ID", "Hardware Version"];

export const isDeviceStub = (r: Record<string, string>) => DEVICE_FIELDS.every((k) => !(r[k] ?? "").trim());

/**
 * One row per home. Devices with no Home WiFi ID (not in any network) and stub rows are left out;
 * a home with only stub rows is left out too.
 */
export function homesFromReport(rows: Record<string, string>[]): HomeApRow[] {
  const byHome = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const id = (r["Home WiFi ID"] ?? "").trim();
    if (!id || isDeviceStub(r)) continue;
    const list = byHome.get(id);
    if (list) list.push(r); else byHome.set(id, [r]);
  }
  return [...byHome].map(([homeId, devs]) => {
    const gw = devs.find((d) => (d["MAC"] ?? "").trim() === homeId) ?? devs.find((d) => d["Work Role"] === "Controller");
    // Some gateway rows have no Model Name but name the device in Product Code ("Beacon 24");
    // codes that are part numbers ("3FE49235BA") say nothing, so only a code that classifies is used.
    const code = (gw?.["Product Code"] ?? "").trim();
    const model = (gw?.["Model Name"] ?? "").trim() || (gatewayKind(code) !== "other" ? code : "");
    const onlineAps = devs.filter(isOnline).length;
    return {
      homeId,
      accountName: devs.find((d) => d["Account Name"])?.["Account Name"] ?? "",
      customerId: devs.find((d) => d["Customer ID"])?.["Customer ID"]?.trim() ?? "",
      gatewayModel: model,
      kind: gw ? gatewayKind(model) : "unknown",
      aps: devs.length,
      onlineAps,
      online: gw ? isOnline(gw) : onlineAps > 0,
      source: "report" as const,
    };
  });
}

/**
 * Counts and gateway status from the live mesh where it was read (the console's view); homes
 * without one (not read yet, read failed, no mesh) keep the report's.
 */
export function withMeshCounts(homes: HomeApRow[], counts: Map<string, MeshCount | null>): HomeApRow[] {
  return homes.map((h) => {
    const m = counts.get(h.homeId);
    return m ? { ...h, aps: m.aps, onlineAps: m.onlineAps, online: m.gatewayOnline, source: "mesh" } : h;
  });
}

/** Devices-per-home buckets: 0 (online count only) … OPEN_BUCKET-1, then "OPEN_BUCKET+". */
export const OPEN_BUCKET = 8;

/** Which count the devices-per-home chart uses: devices registered for the home, or those online now. */
export type ApMeasure = "configured" | "online";

export const apCount = (h: HomeApRow, measure: ApMeasure) => (measure === "online" ? h.onlineAps : h.aps);

export const bucketOf = (aps: number) => Math.max(0, Math.min(aps, OPEN_BUCKET));
export const bucketLabel = (b: number) => (b >= OPEN_BUCKET ? `${OPEN_BUCKET}+` : String(b));

export interface ApBucket {
  bucket: number;
  label: string;
  homes: number;
  /** Homes in the bucket per gateway type (flat keys for the stacked chart). */
  beacon: number; ont: number; fwa: number; other: number; unknown: number;
}

const emptyKinds = (): Record<GatewayKind, number> => ({ beacon: 0, ont: 0, fwa: 0, other: 0, unknown: 0 });

export interface HomeApSummary {
  homes: number;
  /** Sum of the measured count (registered or online devices). */
  aps: number;
  avg: number;
  byKind: Record<GatewayKind, number>;
  /** 1 device … OPEN_BUCKET+, preceded by a 0 bucket when some home has none (online count only). */
  buckets: ApBucket[];
}

export function summariseHomes(homes: HomeApRow[], measure: ApMeasure = "configured"): HomeApSummary {
  const byKind = emptyKinds();
  const bucket = (n: number): ApBucket => ({ bucket: n, label: bucketLabel(n), homes: 0, ...emptyKinds() });
  const all = Array.from({ length: OPEN_BUCKET + 1 }, (_, i) => bucket(i));
  let aps = 0;
  for (const h of homes) {
    const n = apCount(h, measure);
    byKind[h.kind]++;
    const b = all[bucketOf(n)];
    b.homes++;
    b[h.kind]++;
    aps += n;
  }
  return {
    homes: homes.length,
    aps,
    avg: homes.length ? aps / homes.length : 0,
    byKind,
    buckets: all[0].homes ? all : all.slice(1),
  };
}

export const pct = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(1)}%` : "0%");
