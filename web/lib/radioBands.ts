// WiFi radio bands per AP model (client + server safe). An offline AP reports its SSIDs without
// a band, so its bands come from what other APs of the same model reported (radioBandStore.ts)
// or, failing that, from RADIO_SPECS — the same idea as Ethernet port layouts (portLayouts.ts).

import { displayModel, modelKey } from "@/web/lib/portLayouts";

const RADIO_ORDER = ["2.4 GHz", "5 GHz", "5 GHz low", "5 GHz high", "6 GHz"];
const SINGLE: Record<string, string> = { BAND24: "2.4 GHz", BAND50: "5 GHz", BAND50LOW: "5 GHz", BAND50HIGH: "5 GHz", BAND06: "6 GHz" };
const SPLIT: Record<string, string> = { ...SINGLE, BAND50LOW: "5 GHz low", BAND50HIGH: "5 GHz high" };

export const byRadioOrder = (a: string, b: string) => (RADIO_ORDER.indexOf(a) + 1 || 99) - (RADIO_ORDER.indexOf(b) + 1 || 99);

/**
 * One AP's radio band codes (BAND24, BAND50HIGH, …) → labels. "5 GHz low/high" only when the AP
 * has both 5 GHz radios (Beacon 6, Beacon 24); single-5 GHz Beacons tag theirs BAND50HIGH or
 * BAND50LOW too (Beacon 9, 10), so they read "5 GHz". Missing / unknown codes are dropped.
 */
export function radioBandLabels(codes: string[]): string[] {
  const split = codes.includes("BAND50LOW") && codes.includes("BAND50HIGH");
  const labels = codes.map((c) => (split ? SPLIT : SINGLE)[c]).filter((l): l is string => Boolean(l));
  return [...new Set(labels)].sort(byRadioOrder);
}

/** Union of two band lists; a split 5 GHz (low + high) wins over a plain "5 GHz". */
export function mergeBands(a: string[], b: string[]): string[] {
  const all = new Set([...a, ...b]);
  if (all.has("5 GHz low") || all.has("5 GHz high")) all.delete("5 GHz");
  return [...all].sort(byRadioOrder);
}

export const sameBands = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export function isBandList(x: unknown): x is string[] {
  return Array.isArray(x) && x.length > 0 && x.every((b) => RADIO_ORDER.includes(b as string));
}

export interface ModelBands {
  /** modelKey(): "beacon 3.1". */
  model: string;
  displayName: string;
  bands: string[];
  /** MAC of the last AP that added to the list. */
  sampleMac: string;
  updatedAt: string;
}

const B2 = ["2.4 GHz", "5 GHz"];
const B3 = ["2.4 GHz", "5 GHz", "6 GHz"];

/**
 * Radios per model, from a survey of online APs in the fleet (REST mesh, 2026-10-30) — what
 * each model reported when all its radios were up. Used until the fleet itself teaches more.
 */
export const RADIO_SPECS: Record<string, string[]> = {
  "beacon 2": B2, "beacon 3.1": B2, "beacon 3.3": B2, "beacon 4": B2,
  "beacon g3.1": B2, "beacon g6": B2, "beacon g6.2": B2,
  "beacon 6": ["2.4 GHz", "5 GHz low", "5 GHz high"],
  "beacon 9": B3, "beacon 10": B3, "beacon 19": B3, "beacon 19.1": B3,
  "beacon 24": ["2.4 GHz", "5 GHz low", "5 GHz high", "6 GHz"],
};

// "BEACON 6 HA-0336G-A" is a Beacon 6 too.
const specKey = (model: string) => modelKey(model).replace(/^(beacon \S+) ha-\S+$/, "$1");

export type BandSource = "learned" | "spec";

/** Bands for an AP that reported none: learned from the fleet, else the survey table. */
export function bandsForModel(model: string, learned: Map<string, ModelBands> | null): { bands: string[]; source: BandSource } | null {
  const hit = learned?.get(modelKey(model)) ?? learned?.get(specKey(model));
  const spec = RADIO_SPECS[modelKey(model)] ?? RADIO_SPECS[specKey(model)];
  // An AP may have had a radio off when it was learned, so the table fills any gap.
  if (hit?.bands.length) return { bands: mergeBands(hit.bands, spec ?? []), source: "learned" };
  return spec ? { bands: spec, source: "spec" } : null;
}

/** Online APs in a raw mesh payload (REST or MCP `mesh.aps[]`) with the bands they reported. */
export function meshApBands(aps: unknown): { model: string; mac: string; bands: string[] }[] {
  if (!Array.isArray(aps)) return [];
  return (aps as Record<string, unknown>[]).flatMap((a) => {
    const online = String(a.status ?? "").toLowerCase() === "online" || a.xalu_com_online === true;
    const model = displayModel(String(a.ManufacturerModel ?? a.model ?? ""));
    const ssids = Array.isArray(a.ssids) ? (a.ssids as Record<string, unknown>[]) : [];
    const bands = radioBandLabels(ssids.map((s) => String(s.band ?? "")));
    return online && model && bands.length ? [{ model, mac: String(a.macaddress ?? "").toUpperCase().replace(/:/g, "-"), bands }] : [];
  });
}

/** Fill in bands for APs that reported none (offline) from their model; marks where they came from. */
export function applyModelBands<N extends { aps: { model: string; bands: string[]; bandsSource?: BandSource }[] }>(
  network: N, learned: Map<string, ModelBands> | null,
): N {
  if (!network.aps.some((a) => a.bands.length === 0)) return network;
  return {
    ...network,
    aps: network.aps.map((a) => {
      if (a.bands.length) return a;
      const hit = bandsForModel(a.model, learned);
      return hit ? { ...a, bands: hit.bands, bandsSource: hit.source } : a;
    }),
  };
}

/** "from other Beacon 3.1s", "Beacon 3.1 spec" — why an AP's bands aren't its own report. */
export function bandsSourceNote(ap: { model: string; online: boolean; bandsSource?: BandSource }): string | null {
  if (!ap.bandsSource) return null;
  const from = ap.bandsSource === "learned" ? `from other ${ap.model}s` : `${ap.model} spec`;
  return `${from} · ${ap.online ? "not reported" : "AP offline"}`;
}
