// Normalises a Corteca MCP `retrieve-network-data` payload into the shapes the
// existing visualizer components expect (NetworkTopologyData, Member[]).

import type { NetworkTopologyData } from "@/web/components/NetworkTopologyMap";
import type { Member } from "@/web/lib/corteca/types";

export interface McpApiResult { apiId: string; ok: boolean; status: number; data: unknown }

export interface McpAccessPoint {
  mac: string;            // "60-98-49-FF-9F-40"
  serial: string;
  role: string;           // "root" | "beacon"
  model: string;
  firmware: string;
  online: boolean;
  backhaulQuality: string | null;
  ipAddress: string;
  lastBoot: string | null;
  bands: string[];        // e.g. ["2.4 GHz", "5 GHz", "6 GHz"]
  ssids: string[];        // fronthaul SSIDs only
  clientCount: number;
}

export interface McpBackhaulLink {
  parentMac: string;
  childMac: string;
  medium: string;           // "wifi-6", "eth", … ("" when no link record)
  rssiDbm: number | null;   // endpoint metric
  rateMbps: number | null;  // derived data rate
  quality: string | null;   // child AP's Corteca backhaulQuality ("good" | "fair" | "poor")
  errorsTx: number | null;  // endpoint error counters
  errorsRx: number | null;
}

export interface McpNetwork {
  topology: NetworkTopologyData;
  aps: McpAccessPoint[];
  backhaul: McpBackhaulLink[];
  members: Member[];
  results: McpApiResult[];
}

type Obj = Record<string, unknown>;

const toMac = (mac: unknown) => String(mac ?? "").replace(/:/g, "-").toUpperCase();

const BAND_LABEL: Record<string, string> = {
  BAND24: "2.4 GHz", BAND50: "5 GHz", BAND50LOW: "5 GHz", BAND50HIGH: "5 GHz", BAND06: "6 GHz",
};

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
      const ep = Array.isArray(link?.endpoints) ? (link!.endpoints as Obj[])[0] : undefined;
      const rate = Number((link?.derivedData as Obj | undefined)?.dataRate ?? ep?.["data-rate-rx"] ?? 0);
      const quality = byMac.get(childMac)?.backhaulQuality;
      out.push({
        parentMac,
        childMac,
        medium: String(link?.medium ?? "").toLowerCase(),
        rssiDbm: typeof ep?.metric === "number" && ep.metric !== 0 ? ep.metric : null,
        rateMbps: rate > 0 ? Math.round(rate / 1000) : null,
        quality: quality ? String(quality).toLowerCase() : null,
        errorsTx: typeof ep?.["errors-tx"] === "number" ? ep["errors-tx"] : null,
        errorsRx: typeof ep?.["errors-rx"] === "number" ? ep["errors-rx"] : null,
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
      const rate = Number(derived.dataRate ?? ep?.["data-rate-rx"] ?? 0);
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
    return {
      mac,
      serial: String(a.sn ?? a.SerialNumber ?? a.id ?? ""),
      role: String(a.role ?? ""),
      model: String(a.model ?? a.ManufacturerModel ?? "Access Point").replace(/^nokia\s+wifi\s+/i, ""),
      firmware: String(a.firmware_version ?? a.SoftwareVersion ?? ""),
      online: String(a.status ?? "").toLowerCase() === "online" || a.xalu_com_online === true,
      backhaulQuality: a.backhaulQuality ? String(a.backhaulQuality) : null,
      ipAddress: String(a.ipaddress ?? ""),
      lastBoot: a.last_boot ? String(a.last_boot) : null,
      bands: [...new Set(ssids.map((s) => BAND_LABEL[String(s.band)] ?? String(s.band)))].sort(),
      ssids: [...new Set(fronthaul.map((s) => String(s.ssid)))],
      clientCount: clientsByAp.get(mac) ?? 0,
    };
  }).sort((x, y) => (x.role === "root" ? -1 : y.role === "root" ? 1 : x.mac.localeCompare(y.mac)));

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
  };
}
