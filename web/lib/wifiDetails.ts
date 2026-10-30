// Gateway WiFi details (see /api/network/[deviceId]/wifi-details) applied to an
// MCP network, the same way deviceNames.ts applies nicknames: APs get `radios`,
// backhaul links get `standard`, clients get the gateway's decoded standard.
// Anything missing or malformed is dropped, so the MCP-only view stays.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import type { AssociationStandard } from "@/web/lib/wifiAssociation";
import type { ApRadio } from "@/web/lib/wifiRadios";
import { isMloClient } from "@/web/lib/clientFields";

export interface WifiDetails {
  /** AP MAC (lowercase colon form) → radios. */
  radios: Record<string, ApRadio[]>;
  /** Station MAC (lowercase colon form) → negotiated standard. */
  backhaul: Record<string, AssociationStandard>;
  clients: Record<string, AssociationStandard>;
}

const GENERATIONS = ["WiFi 4", "WiFi 5", "WiFi 6", "WiFi 7"];
const colon = (mac: string) => mac.toLowerCase().replace(/-/g, ":");

function standardOk(v: unknown): v is AssociationStandard {
  const s = v as AssociationStandard | null;
  return !!s && GENERATIONS.includes(s.generation) && /^802\.11[a-z]{1,2}$/.test(s.ieee) && typeof s.mlo === "boolean";
}

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function radioOk(v: unknown): ApRadio | null {
  const r = v as Partial<ApRadio> | null;
  if (!r || typeof r.band !== "string") return null;
  return {
    band: r.band,
    channel: numOrNull(r.channel),
    widthMhz: numOrNull(r.widthMhz),
    txPowerDbm: numOrNull(r.txPowerDbm),
    utilization: numOrNull(r.utilization),
    utilizationAvg: numOrNull(r.utilizationAvg),
    transmit: numOrNull(r.transmit),
    receiveSelf: numOrNull(r.receiveSelf),
    receiveOther: numOrNull(r.receiveOther),
    noiseDbm: numOrNull(r.noiseDbm),
    bssids: Array.isArray(r.bssids) ? r.bssids.filter((b): b is string => typeof b === "string").map(colon) : [],
    backhaulStaMac: typeof r.backhaulStaMac === "string" ? colon(r.backhaulStaMac) : null,
  };
}

/** Validates a wifi-details response; null if it isn't one. */
export function sanitiseWifiDetails(raw: unknown): WifiDetails | null {
  const d = raw as Partial<WifiDetails> | null;
  if (!d || typeof d !== "object") return null;
  const out: WifiDetails = { radios: {}, backhaul: {}, clients: {} };
  for (const [mac, list] of Object.entries(d.radios ?? {})) {
    const radios = (Array.isArray(list) ? list : []).map(radioOk).filter((r): r is ApRadio => !!r);
    if (radios.length) out.radios[colon(mac)] = radios;
  }
  for (const key of ["backhaul", "clients"] as const) {
    for (const [mac, std] of Object.entries(d[key] ?? {})) if (standardOk(std)) out[key][colon(mac)] = std;
  }
  return out;
}

export function applyWifiDetails(network: McpNetwork, details: WifiDetails | null): McpNetwork {
  if (!details) return network;
  const radiosOf = new Map(network.aps.map((a) => [a.mac, details.radios[colon(a.mac)]]));
  const backhaulRadios = new Set<ApRadio>();

  // The radio a backhaul band runs on, and so its channel. An AP can run fronthaul and backhaul on
  // different radios (channels) of the same band, so match the parent's BSSID, then the child's
  // backhaul station; the band label only as a fallback.
  const channelOf = (l: { parentMac: string; childMac: string }, band: string | null, parentBssid?: string | null, staMac?: string | null) => {
    const parent = radiosOf.get(l.parentMac), child = radiosOf.get(l.childMac);
    const byBssid = parentBssid ? parent?.find((r) => r.bssids?.includes(parentBssid)) : undefined;
    const bySta = staMac ? child?.find((r) => r.backhaulStaMac === staMac) : undefined;
    for (const r of [byBssid, bySta]) if (r) backhaulRadios.add(r);
    const radio = byBssid ?? bySta ?? (band ? linkRadio(parent, band) ?? linkRadio(child, band) : null);
    return radio?.channel != null ? { channel: radio.channel, widthMhz: radio.widthMhz } : null;
  };
  const backhaul = network.backhaul.map((l) => {
    const standard = l.childStaMac ? details.backhaul[l.childStaMac] : undefined;
    // MLO: a channel per band; the link itself spans several, so it has none of its own.
    if (l.mloBands) {
      const mloBands = l.mloBands.map((b) => ({ ...b, ...channelOf(l, b.band, b.parentBssid, b.staMac) }));
      return { ...l, ...(standard && { standard }), mloBands };
    }
    const channel = channelOf(l, l.band, l.parentBssid, l.childStaMac);
    return standard || channel ? { ...l, ...(standard && { standard }), ...channel } : l;
  });
  const aps = network.aps.map((ap) => {
    const radios = radiosOf.get(ap.mac);
    return radios ? { ...ap, radios: radios.map((r) => (backhaulRadios.has(r) ? { ...r, backhaul: true } : r)) } : ap;
  });
  const members = network.members.map((m) => {
    const gatewayStandard = details.clients[colon(m.id)];
    return gatewayStandard ? ({ ...m, gatewayStandard } as Member) : m;
  });
  return { ...network, aps, backhaul, members, topology: { ...network.topology, members } };
}

/** The AP radio on a backhaul band: same label, else the only radio of that band family ("5 GHz" ↔ "5 GHz high"). */
function linkRadio(radios: ApRadio[] | undefined, band: string): ApRadio | null {
  if (!radios?.length) return null;
  const exact = radios.filter((r) => r.band === band);
  if (exact.length === 1) return exact[0];
  const family = (b: string) => b.replace(/ (low|high)$/, "");
  const same = radios.filter((r) => family(r.band) === family(band));
  // Several radios on one band (e.g. fronthaul and backhaul on different 6 GHz channels): no guess.
  return same.length === 1 ? same[0] : null;
}

// ── Client WiFi standard ─────────────────────────────────────────────────────

const IEEE_GENERATION: Record<string, string> = {
  "802.11be": "WiFi 7", "802.11ax": "WiFi 6", "802.11ac": "WiFi 5", "802.11n": "WiFi 4",
  "802.11g": "WiFi 3", "802.11a": "WiFi 2", "802.11b": "WiFi 1",
};

export interface ClientStandard { generation: string; ieee: string; mlo: boolean }

/**
 * A client's WiFi standard: MCP's `wifi_standard` (matched the gateway's
 * association requests on every client checked), else the gateway's decode.
 * MLO: the client reports two or more affiliated links (clientLinks), else the gateway says so.
 */
export function clientStandard(m: Member): ClientStandard | null {
  const raw = m as unknown as {
    client_capabilities?: { wifi_standard?: string };
    capabilities?: { wifi_standard?: string };
    wifi_standard?: string;
    gatewayStandard?: AssociationStandard;
  };
  const gw = raw.gatewayStandard;
  const ieee = String(raw.client_capabilities?.wifi_standard ?? raw.capabilities?.wifi_standard ?? raw.wifi_standard ?? "").toLowerCase().replace(/\s+/g, "");
  const generation = IEEE_GENERATION[ieee];
  const mlo = isMloClient(m) || !!gw?.mlo;
  if (generation) return { generation, ieee, mlo };
  if (gw) return { generation: gw.generation, ieee: gw.ieee, mlo };
  return mlo ? { generation: "WiFi 7", ieee: "802.11be", mlo } : null;
}

/** WiFi 5 or older: slows the shared airtime for everyone on that radio. */
export function isOlderWifi(m: Member): boolean {
  const s = clientStandard(m);
  return !!s && Number(s.generation.replace(/\D/g, "")) <= 5;
}

export const standardLabel = (s: ClientStandard | AssociationStandard) =>
  `${s.generation} (${s.ieee})${s.mlo ? " · multi-link" : ""}`;
