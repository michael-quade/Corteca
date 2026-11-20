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

/** One row per home; devices with no Home WiFi ID (not in any network) are left out. */
export function homesFromReport(rows: Record<string, string>[]): HomeApRow[] {
  const byHome = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const id = (r["Home WiFi ID"] ?? "").trim();
    if (!id) continue;
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
    };
  });
}

/** Devices-per-home buckets: 1 … OPEN_BUCKET-1, then "OPEN_BUCKET+". */
export const OPEN_BUCKET = 8;

export const bucketOf = (aps: number) => Math.min(aps, OPEN_BUCKET);
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
  aps: number;
  avg: number;
  byKind: Record<GatewayKind, number>;
  /** Index 0 = 1 device … last = OPEN_BUCKET+. */
  buckets: ApBucket[];
}

export function summariseHomes(homes: HomeApRow[]): HomeApSummary {
  const byKind = emptyKinds();
  const buckets: ApBucket[] = Array.from({ length: OPEN_BUCKET }, (_, i) => ({ bucket: i + 1, label: bucketLabel(i + 1), homes: 0, ...emptyKinds() }));
  let aps = 0;
  for (const h of homes) {
    byKind[h.kind]++;
    const b = buckets[bucketOf(h.aps) - 1];
    b.homes++;
    b[h.kind]++;
    aps += h.aps;
  }
  return {
    homes: homes.length,
    aps,
    avg: homes.length ? aps / homes.length : 0,
    byKind,
    buckets,
  };
}

export const pct = (n: number, of: number) => (of ? `${((n / of) * 100).toFixed(1)}%` : "0%");
