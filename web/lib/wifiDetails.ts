// Gateway WiFi details (see /api/network/[deviceId]/wifi-details) applied to an
// MCP network, the same way deviceNames.ts applies nicknames: APs get `radios`,
// backhaul links get `standard`, clients get the gateway's decoded standard.
// Anything missing or malformed is dropped, so the MCP-only view stays.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import type { AssociationStandard } from "@/web/lib/wifiAssociation";
import type { ApRadio } from "@/web/lib/wifiRadios";

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
  const aps = network.aps.map((ap) => {
    const radios = details.radios[colon(ap.mac)];
    return radios ? { ...ap, radios } : ap;
  });
  const radiosOf = new Map(aps.map((a) => [a.mac, a.radios]));
  const backhaul = network.backhaul.map((l) => {
    const standard = l.childStaMac ? details.backhaul[l.childStaMac] : undefined;
    // Both ends of a wireless link share one channel: the parent's radio on the link's band names it.
    const radio = l.band ? linkRadio(radiosOf.get(l.parentMac), l.band) ?? linkRadio(radiosOf.get(l.childMac), l.band) : null;
    const channel = radio?.channel != null ? { channel: radio.channel, widthMhz: radio.widthMhz } : null;
    return standard || channel ? { ...l, ...(standard && { standard }), ...channel } : l;
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
  const exact = radios.find((r) => r.band === band);
  if (exact) return exact;
  const family = (b: string) => b.replace(/ (low|high)$/, "");
  const same = radios.filter((r) => family(r.band) === family(band));
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
 * MLO only comes from the gateway.
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
  if (generation) return { generation, ieee, mlo: gw?.mlo ?? false };
  return gw ? { generation: gw.generation, ieee: gw.ieee, mlo: gw.mlo } : null;
}

/** WiFi 5 or older: slows the shared airtime for everyone on that radio. */
export function isOlderWifi(m: Member): boolean {
  const s = clientStandard(m);
  return !!s && Number(s.generation.replace(/\D/g, "")) <= 5;
}

export const standardLabel = (s: ClientStandard | AssociationStandard) =>
  `${s.generation} (${s.ieee})${s.mlo ? " · multi-link" : ""}`;
