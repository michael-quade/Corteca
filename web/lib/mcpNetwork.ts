// Normalises a Corteca MCP `retrieve-network-data` payload into the shapes the
// existing visualizer components expect (NetworkTopologyData, Member[]).

import type { NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import type { Member } from "@/web/lib/corteca/types";
import type { AssociationStandard } from "@/web/lib/wifiAssociation";
import type { ApRadio } from "@/web/lib/wifiRadios";
import type { AiNotes } from "@/web/lib/aiAnalysis";
import type { InferredSwitch } from "@/web/lib/inferredSwitches";

export interface McpApiResult { apiId: string; ok: boolean; status: number; data: unknown }

export interface McpAccessPoint {
  mac: string;            // "60-98-49-FF-9F-40"
  serial: string;
  role: string;           // "root" | "beacon"
  /** Role label, "Gateway" or "Beacon". */
  name: string;
  /** User-given name from the gateway's device map ("MBR"), applied by applyDeviceNames(). */
  nickname?: string;
  model: string;
  firmware: string;
  hardwareVersion: string;
  online: boolean;
  backhaulQuality: string | null;
  ipAddress: string;      // LAN
  wanIp: string;          // public address the AP reaches the cloud from
  lastBoot: string | null;
  lastOffline: string | null;
  bands: string[];        // e.g. ["2.4 GHz", "5 GHz", "6 GHz"]
  ssids: string[];        // fronthaul SSIDs only
  /** fronthaul SSID → bands it is broadcast on */
  ssidBands: Record<string, string[]>;
  clientCount: number;
  /** Channel / width / airtime per radio, from the gateway (applyWifiDetails). */
  radios?: ApRadio[];
  /** Lines about this AP from the AI analysis report (applyAiReport). */
  ai?: AiNotes;
}

export interface McpBackhaulLink {
  parentMac: string;
  childMac: string;
  medium: string;           // "wifi-6", "ethernet", … ("" when no link record)
  /** Radio band of a wireless link ("6 GHz"). Corteca's `medium` "wifi-6" is the 6 GHz band, not the WiFi 6 standard. */
  band: string | null;
  /** The child AP's backhaul station MAC (its endpoint BSSID, lowercase colon form) — keys the gateway's per-station records. */
  childStaMac: string | null;
  /** Negotiated WiFi standard, from the gateway (applyWifiDetails); absent when unknown. */
  standard?: AssociationStandard;
  rssiDbm: number | null;   // endpoint metric
  rateMbps: number | null;  // derived data rate
  phyRateMbps: number | null;
  quality: string | null;   // child AP's Corteca backhaulQuality ("good" | "fair" | "poor")
  // Counters from the child AP's end: tx goes up toward the gateway, rx comes down.
  errorsTx: number | null;
  errorsRx: number | null;
  bytesUp: number | null;
  bytesDown: number | null;
}

export interface McpNetwork {
  topology: NetworkTopologyData;
  aps: McpAccessPoint[];
  backhaul: McpBackhaulLink[];
  members: Member[];
  results: McpApiResult[];
  /** When Corteca captured the mesh snapshot (ISO), from the payload's `timestamp`. */
  capturedAt: string | null;
  /** Inferred L2 switches (applySwitches). */
  switches?: InferredSwitch[];
}

type Obj = Record<string, unknown>;

const toMac = (mac: unknown) => String(mac ?? "").replace(/:/g, "-").toUpperCase();

const BAND_LABEL: Record<string, string> = {
  BAND24: "2.4 GHz", BAND50: "5 GHz", BAND50LOW: "5 GHz", BAND50HIGH: "5 GHz", BAND06: "6 GHz",
};

// Radio-level labels. Tri-band WiFi 6 Beacons (e.g. Beacon 6) have no 6 GHz radio
// and split 5 GHz into a low and a high radio; clients only ever see "5 GHz", so
// client-facing band lists (ssidBands, filters) keep BAND_LABEL.
const RADIO_LABEL: Record<string, string> = {
  BAND24: "2.4 GHz", BAND50: "5 GHz", BAND50LOW: "5 GHz low", BAND50HIGH: "5 GHz high", BAND06: "6 GHz",
};
const RADIO_ORDER = ["2.4 GHz", "5 GHz", "5 GHz low", "5 GHz high", "6 GHz"];
const byRadioOrder = (a: string, b: string) => (RADIO_ORDER.indexOf(a) + 1 || 99) - (RADIO_ORDER.indexOf(b) + 1 || 99);

// Fallback when no endpoint BSSID matches a radio. A link's medium names its band:
// "wifi-6" = 6 GHz (also between WiFi 7 Beacons), "wifi-5high" = 5 GHz high radio.
const MEDIUM_BAND: Record<string, string> = {
  "wifi-6": "6 GHz", "wifi-5": "5 GHz", "wifi-5low": "5 GHz low", "wifi-5high": "5 GHz high", "wifi-2.4": "2.4 GHz", "wifi-24": "2.4 GHz",
};

/**
 * A link's data rate in kbps. Newer Beacons report kbps; tri-band WiFi 6 Beacons
 * (Beacon 6) report Mbps (dataRate 1441 next to phyRate 1441000). A data rate under
 * 1% of the PHY rate can only be the Mbps form.
 */
function linkRateKbps(dataRate: number, phyRateKbps: number): number {
  return dataRate > 0 && phyRateKbps > 0 && dataRate * 100 < phyRateKbps ? dataRate * 1000 : dataRate;
}

export function extractResults(payload: unknown): McpApiResult[] {
  const results = (payload as Obj | null)?.results;
  return Array.isArray(results) ? (results as McpApiResult[]) : [];
}

// The mesh payload has no explicit tree; `meshbackhaulnodes` lists each AP's
// downstream AP serials. Synthesise topology nodes ({ device_id, children })
// for buildTree, attaching any unreached AP directly to the root.
function synthesiseTopology(aps: Obj[], rootMac: string): Obj {
  const macBySerial = new Map(aps.map((a) => [String(a.id ?? a.sn ?? ""), toMac(a.macaddress)]));
  const childrenOf = new Map<string, string[]>();
  for (const ap of aps) {
    const kids = Array.isArray(ap.meshbackhaulnodes) ? ap.meshbackhaulnodes : [];
    childrenOf.set(toMac(ap.macaddress), kids.map((s) => macBySerial.get(String(s)) ?? "").filter(Boolean));
  }
  const reached = new Set<string>();
  function build(mac: string, depth: number): Obj {
    reached.add(mac);
    const children = (childrenOf.get(mac) ?? []).filter((c) => !reached.has(c)).map((c) => build(c, depth + 1));
    return { device_id: mac, depth, children };
  }
  const root = build(rootMac, 0);
  for (const mac of childrenOf.keys()) {
    if (!reached.has(mac)) (root.children as Obj[]).push(build(mac, 1));
  }
  return root;
}

// One entry per parent→child AP edge of the synthesised tree, joined to the
// mesh link record whose two endpoints are those APs' serials.
function buildBackhaul(tree: Obj | null, rawAps: Obj[], mesh: Obj | null): McpBackhaulLink[] {
  if (!tree) return [];
  const byMac = new Map(rawAps.map((a) => [toMac(a.macaddress), a]));
  // BSSID → band of the radio it belongs to; a link's endpoint BSSIDs pin its band.
  const bandByBssid = new Map<string, string>();
  for (const a of rawAps) {
    for (const s of Array.isArray(a.ssids) ? (a.ssids as Obj[]) : []) {
      const band = RADIO_LABEL[String(s.band)];
      if (band && s.bssid) bandByBssid.set(String(s.bssid).toLowerCase(), band);
    }
  }
  const links = Array.isArray(mesh?.links) ? (mesh!.links as Obj[]) : [];
  const out: McpBackhaulLink[] = [];
  function walk(node: Obj) {
    const parentMac = String(node.device_id);
    for (const child of (node.children as Obj[]) ?? []) {
      const childMac = String(child.device_id);
      const pSerial = String(byMac.get(parentMac)?.id ?? "");
      const cSerial = String(byMac.get(childMac)?.id ?? "");
      const link = links.find((l) => {
        const ids = (Array.isArray(l.endpoints) ? (l.endpoints as Obj[]) : []).map((e) => String(e.id ?? ""));
        return ids.includes(pSerial) && ids.includes(cSerial);
      });
      const eps = Array.isArray(link?.endpoints) ? (link!.endpoints as Obj[]) : [];
      const ep = eps.find((e) => String(e.id) === cSerial) ?? eps[0];
      const derived = (link?.derivedData ?? {}) as Obj;
      const phy = Number(derived.phyRate ?? 0);
      const rate = linkRateKbps(Number(derived.dataRate ?? ep?.["data-rate-rx"] ?? 0), phy);
      const quality = byMac.get(childMac)?.backhaulQuality;
      const medium = String(link?.medium ?? "").toLowerCase();
      const band = medium.includes("eth") ? null
        : eps.flatMap((e) => [e.bssid, e["remote-bssid"]]).map((b) => bandByBssid.get(String(b ?? "").toLowerCase())).find(Boolean)
          ?? MEDIUM_BAND[medium] ?? null;
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      out.push({
        parentMac,
        childMac,
        medium,
        band,
        childStaMac: ep?.bssid && String(ep.id) === cSerial ? String(ep.bssid).toLowerCase() : null,
        rssiDbm: typeof ep?.metric === "number" && ep.metric !== 0 ? ep.metric : null,
        rateMbps: rate > 0 ? Math.round(rate / 1000) : null,
        phyRateMbps: phy > 0 ? Math.round(phy / 1000) : null,
        quality: quality ? String(quality).toLowerCase() : null,
        errorsTx: num(ep?.["errors-tx"]),
        errorsRx: num(ep?.["errors-rx"]),
        bytesUp: num(ep?.["total-bytes-tx"]),
        bytesDown: num(ep?.["total-bytes-rx"]),
      });
      walk(child);
    }
  }
  walk(tree);
  return out;
}

// Lift per-endpoint signal and derived rate onto the link so linkTip() can show them.
function enrichLinks(mesh: Obj): Obj {
  const links = Array.isArray(mesh.links) ? (mesh.links as Obj[]) : [];
  return {
    ...mesh,
    links: links.map((l) => {
      const ep = Array.isArray(l.endpoints) ? (l.endpoints[0] as Obj | undefined) : undefined;
      const derived = (l.derivedData ?? {}) as Obj;
      const rate = linkRateKbps(Number(derived.dataRate ?? ep?.["data-rate-rx"] ?? 0), Number(derived.phyRate ?? 0));
      return {
        ...l,
        rssi: ep?.metric ?? undefined,
        rx_rate: rate > 0 ? Math.round(rate / 1000) : undefined,
      };
    }),
  };
}

export function normaliseMcpNetwork(payload: unknown, homeWifiId: string): McpNetwork {
  const results = extractResults(payload);
  const meshData = (results.find((r) => r.apiId === "mesh" && r.ok)?.data ?? null) as Obj | null;
  const membersRaw = results.find((r) => r.apiId === "members" && r.ok)?.data;
  const members = (Array.isArray(membersRaw) ? membersRaw : []) as Member[];

  const rawAps = Array.isArray(meshData?.aps) ? (meshData!.aps as Obj[]) : [];
  const rootMac = toMac(rawAps.find((a) => a.role === "root")?.macaddress) || homeWifiId;

  const clientsByAp = new Map<string, number>();
  for (const m of members) {
    if (m.connected && m.device_id) clientsByAp.set(m.device_id, (clientsByAp.get(m.device_id) ?? 0) + 1);
  }

  const aps: McpAccessPoint[] = rawAps.map((a) => {
    const mac = toMac(a.macaddress);
    const ssids = Array.isArray(a.ssids) ? (a.ssids as Obj[]) : [];
    const fronthaul = ssids.filter((s) => !s.backhaulUse && s.ssidStatus && s.ssid);
    const bandOf = (s: Obj) => BAND_LABEL[String(s.band)] ?? String(s.band);
    const ssidBands: Record<string, string[]> = {};
    for (const s of fronthaul) ssidBands[String(s.ssid)] = [...new Set([...(ssidBands[String(s.ssid)] ?? []), bandOf(s)])];
    const role = String(a.role ?? "");
    const index = typeof a.deviceIndex === "number" ? a.deviceIndex : null;
    return {
      mac,
      serial: String(a.sn ?? a.SerialNumber ?? a.id ?? ""),
      role,
      name: role === "root" ? "Gateway" : "Beacon",
      model: String(a.model ?? a.ManufacturerModel ?? "Access Point").replace(/^nokia\s+wifi\s+/i, ""),
      firmware: String(a.firmware_version ?? a.SoftwareVersion ?? ""),
      hardwareVersion: String(a.hardware_version ?? ""),
      online: String(a.status ?? "").toLowerCase() === "online" || a.xalu_com_online === true,
      backhaulQuality: a.backhaulQuality ? String(a.backhaulQuality) : null,
      ipAddress: String(a.ipaddress ?? ""),
      wanIp: String(a.ip_address ?? ""),
      lastBoot: a.last_boot ? String(a.last_boot) : null,
      lastOffline: a.last_offline ? String(a.last_offline) : null,
      bands: [...new Set(ssids.map((x) => RADIO_LABEL[String(x.band)] ?? String(x.band)))].sort(byRadioOrder),
      ssids: Object.keys(ssidBands),
      ssidBands,
      clientCount: clientsByAp.get(mac) ?? 0,
      index,
    };
  })
    // Gateway first, then by beacon number.
    .sort((x, y) => (x.role === "root" ? -1 : y.role === "root" ? 1 : (x.index ?? 99) - (y.index ?? 99)))
    .map(({ index: _index, ...ap }) => ap);

  const tree = rawAps.length ? synthesiseTopology(rawAps, rootMac) : null;

  return {
    topology: {
      networks: null,
      topology: tree,
      mesh: meshData ? enrichLinks(meshData) : null,
      configs: {},
      members,
      rootDeviceId: rootMac,
    },
    aps,
    backhaul: buildBackhaul(tree, rawAps, meshData),
    members,
    results,
    capturedAt: typeof meshData?.timestamp === "number" ? new Date(meshData.timestamp * 1000).toISOString() : null,
  };
}
