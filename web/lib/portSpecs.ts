// RJ-45 port layouts from Nokia's product spec sheets (portfolio spreadsheet and the
// Beacon line-up slides, 2026). Used until a device of the model is seen live as a
// gateway, and to fill in LAN max speeds, which TR-181 reports as auto (-1).
// The sheets give counts and speeds only, not which physical LAN port is the fast
// one: the faster ports are listed first here, which hasn't been confirmed.
// PON gateways have no RJ-45 WAN (GPON / XGS-PON uplink).

import type { LayoutPort } from "@/web/lib/portLayouts";

const G = 1000;

/** WAN speed (Mbps, null = no RJ-45 WAN) and LAN speeds, fastest first. */
const SPECS: Record<string, { wan: number | null; lan: number[] }> = {
  "beacon 1.1":  { wan: G,      lan: [G, G] },
  "beacon 2":    { wan: G,      lan: [G] },
  "beacon 3.1":  { wan: G,      lan: [G, G] },
  "beacon 4":    { wan: 2.5 * G, lan: [G, G] },
  "beacon 6":    { wan: G,      lan: [G, G] },
  "beacon 9":    { wan: 2.5 * G, lan: [2.5 * G, G] },
  "beacon 10":   { wan: 10 * G, lan: [2.5 * G, G, G] },
  // Same ports as the 19.1 (the portfolio sheet's "2× 1G" leaves out the 10G LAN).
  "beacon 19":   { wan: 10 * G, lan: [10 * G, G, G] },
  "beacon 19.1": { wan: 10 * G, lan: [10 * G, G, G] },
  "beacon 24":   { wan: 10 * G, lan: [10 * G, 2.5 * G, 2.5 * G] },
  "beacon g6":   { wan: 2.5 * G, lan: [2.5 * G, G, G] },
  "beacon g6.2": { wan: 2.5 * G, lan: [2.5 * G, G, G] },
  "g-2426g-b":   { wan: null,   lan: [2.5 * G, G, G, G] },
  "xs-2426g-b":  { wan: null,   lan: [2.5 * G, G, G, G] },
  "xs-2426x-a":  { wan: null,   lan: [10 * G, G, G, G] },
  // The portfolio sheet (listed as upcoming) says 3× 1G LAN; the newer line-up slide says 2×.
  "xs-2437x-b":  { wan: null,   lan: [10 * G, G, G] },
  "xs-1427x-a":  { wan: null,   lan: [10 * G, G, G, G] },
};

/** Spec-sheet layout for a modelKey(), WAN first. */
export function specLayout(key: string): LayoutPort[] | null {
  const s = SPECS[key];
  if (!s) return null;
  return [
    ...(s.wan ? [{ name: "WAN", upstream: true, maxBitRate: s.wan }] : []),
    ...s.lan.map((maxBitRate, i) => ({ name: `LAN ${i + 1}`, upstream: false, maxBitRate })),
  ];
}

/**
 * A live/stored layout with unreported max speeds (-1) filled from the spec sheet,
 * when the two agree on the number of WAN and LAN ports.
 */
export function withSpecSpeeds(key: string, ports: LayoutPort[]): LayoutPort[] {
  const spec = specLayout(key);
  if (!spec) return ports;
  const wan = (l: LayoutPort[]) => l.filter((p) => p.upstream);
  const lan = (l: LayoutPort[]) => l.filter((p) => !p.upstream);
  if (wan(spec).length !== wan(ports).length || lan(spec).length !== lan(ports).length) return ports;
  const specWan = wan(spec), specLan = lan(spec);
  let w = 0, l = 0;
  return ports.map((p) => {
    const s = p.upstream ? specWan[w++] : specLan[l++];
    return p.maxBitRate > 0 ? p : { ...p, maxBitRate: s.maxBitRate };
  });
}

/** True when a live/stored layout has a different port count than the spec sheet. */
export function differsFromSpec(key: string, ports: LayoutPort[]): boolean {
  const spec = specLayout(key);
  return !!spec && (spec.filter((p) => p.upstream).length !== ports.filter((p) => p.upstream).length
    || spec.filter((p) => !p.upstream).length !== ports.filter((p) => !p.upstream).length);
}
