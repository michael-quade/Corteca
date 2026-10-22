// Ethernet port layout per device model (client + server safe). Mesh Beacons don't
// report their ports, but a Beacon working as a gateway does (live TR-181), and the
// hardware is the same either way — so layouts are learned from gateways, stored
// (portLayoutStore.ts), and used for mesh Beacons of that model.

import type { EthernetPort } from "@/web/components/EthernetPortPanel";
import { getModelFallbackPorts } from "@/web/lib/ethernetPorts";
import { differsFromSpec, specLayout, withSpecSpeeds } from "@/web/lib/portSpecs";

export type PortLayoutSource = "live" | "documentation" | "manual";

export interface LayoutPort {
  name: string;
  upstream: boolean;
  /** Mbps; -1 = auto / not reported. */
  maxBitRate: number;
}

export interface PortLayout {
  /** modelKey(): "beacon 10". */
  model: string;
  /** "Beacon 10". */
  displayName: string;
  hardwareVersion: string;
  /** WAN first, then LAN ports in order. */
  ports: LayoutPort[];
  source: PortLayoutSource;
  /** MAC of the device the layout was read from (live). */
  sampleMac: string;
  updatedAt: string;
}

/** "Nokia WiFi Beacon 10" → "Beacon 10". */
export const displayModel = (raw: string) => raw.replace(/^nokia\s+(wifi\s+)?/i, "").trim();
export const modelKey = (raw: string) => displayModel(raw).toLowerCase().replace(/\s+/g, " ");

/** Live ports → layout (WAN first, then LAN by interface index). */
export function layoutFromLive(ports: EthernetPort[]): LayoutPort[] {
  return [...ports]
    .sort((a, b) => (a.upstream !== b.upstream ? (a.upstream ? -1 : 1) : a.index - b.index))
    .map((p) => ({ name: p.name, upstream: p.upstream, maxBitRate: p.maxBitRate > 0 ? p.maxBitRate : -1 }));
}

export const sameLayout = (a: LayoutPort[], b: LayoutPort[]) =>
  a.length === b.length && a.every((p, i) => p.name === b[i].name && p.upstream === b[i].upstream && p.maxBitRate === b[i].maxBitRate);

export function isLayoutPorts(x: unknown): x is LayoutPort[] {
  return Array.isArray(x) && x.length > 0 && x.every((p) =>
    p && typeof p === "object" && typeof (p as LayoutPort).name === "string"
    && typeof (p as LayoutPort).upstream === "boolean" && typeof (p as LayoutPort).maxBitRate === "number");
}

/** Layout → port rows with no status (filled in from Corteca's reports by meshApPorts). */
export function layoutToPorts(ports: LayoutPort[]): EthernetPort[] {
  return ports.map((p, i) => ({
    index: i + 1, name: p.name, upstream: p.upstream, enable: true, status: "Unknown",
    maxBitRate: p.maxBitRate, currentBitRate: 0, duplexMode: "", macAddress: "", connectedHost: null,
  }));
}

/** Live ports with the max speeds TR-181 leaves as auto filled from the spec sheet. */
export function withSpecMaxRates(model: string, ports: EthernetPort[]): EthernetPort[] {
  const filled = withSpecSpeeds(modelKey(model), layoutFromLive(ports));
  const sorted = [...ports].sort((a, b) => (a.upstream !== b.upstream ? (a.upstream ? -1 : 1) : a.index - b.index));
  return sorted.map((p, i) => ({ ...p, maxBitRate: p.maxBitRate > 0 ? p.maxBitRate : filled[i].maxBitRate }));
}

/**
 * Port layout for a mesh Beacon of `model`: this network's gateway when it is the
 * same model (its live ports), else a stored layout, else Nokia's spec sheet, else
 * the generic Beacon layout. Max speeds the device doesn't report come from the
 * spec sheet. `note` says where it came from.
 */
export function beaconPortLayout(
  model: string,
  layouts: Map<string, PortLayout> | null,
  gateway: { model: string; ports: EthernetPort[] } | null,
): { ports: EthernetPort[]; note: string } {
  const key = modelKey(model);
  const name = displayModel(model) || "this model";
  const confirmed = (ports: LayoutPort[], from: string) => ({
    ports: layoutToPorts(withSpecSpeeds(key, ports)),
    note: `Port layout of ${name} ${from}${differsFromSpec(key, ports) ? " (differs from Nokia's spec sheet)" : ""}.`,
  });
  if (gateway?.ports.length && modelKey(gateway.model) === key) {
    return confirmed(layoutFromLive(gateway.ports), "from this network's gateway (same hardware)");
  }
  const stored = layouts?.get(key);
  if (stored) {
    return confirmed(stored.ports, stored.source === "live" ? `learned from a ${stored.displayName} gateway's live ports`
      : stored.source === "manual" ? "entered manually" : "from documentation");
  }
  const spec = specLayout(key);
  if (spec) return { ports: layoutToPorts(spec), note: `Port layout of ${name} from Nokia's spec sheet; not yet confirmed on a live ${name}.` };
  const generic = getModelFallbackPorts(name);
  return {
    ports: generic,
    note: generic.length ? `${name} isn't in the spec sheet and hasn't been seen as a gateway, so this is a generic Beacon layout (WAN + 3 LAN); the real ports may differ.` : "",
  };
}
