// Client fields shared by the topology canvas, panels and filters (band, signal, name).

import type { Member } from "@/web/lib/corteca/types";
import type { Band, Quality } from "@/web/lib/topologyFlow";

function bandOfFrequency(mhz: number): Band {
  if (mhz >= 2400 && mhz < 2500) return "2.4 GHz";
  if (mhz >= 4900 && mhz < 5900) return "5 GHz";
  if (mhz >= 5925) return "6 GHz";
  return "Other";
}

/** The band Corteca files the client under (its `frequency`); an MLO client is filed under one of its links. */
export function clientBand(m: Member): Band {
  if (String(m.type ?? "").toLowerCase() === "ethernet") return "Wired";
  return bandOfFrequency(Number(m.frequency ?? 0));
}

export const isWired = (m: Member) => String(m.type ?? "").toLowerCase() === "ethernet";

// ── MLO (WiFi 7 multi-link) ─────────────────────────────────────────────────

/** One affiliated link of an MLO client, from the MCP member's `links[]`. */
export interface ClientLink {
  band: Band;
  channel: number | null;
  frequency: number;
  signalDbm: number | null;
  /** The client's MAC on this link (its MLD MAC is the member id). */
  mac: string;
  bssid: string;
  /** kbps, from the AP's view: its tx is the client's download. */
  rxRateKbps: number;
  txRateKbps: number;
}

interface RawLink {
  bssid?: string; channel?: number; frequency?: number; mac?: string; signal?: number;
  rx_statistics?: { rate?: number }; tx_statistics?: { rate?: number };
}

const BAND_ORDER: Band[] = ["6 GHz", "5 GHz", "2.4 GHz", "Other"];

/**
 * An MLO client's links (6 → 5 → 2.4 GHz); empty for any other client. Corteca lists
 * one row per MLO client, keyed by its MLD MAC, with one `links[]` entry per band.
 */
export function clientLinks(m: Member): ClientLink[] {
  const raw = (m as unknown as { links?: RawLink[] }).links;
  if (isWired(m) || !Array.isArray(raw) || raw.length < 2) return [];
  return raw
    .map((l) => ({
      band: bandOfFrequency(Number(l.frequency ?? 0)),
      channel: typeof l.channel === "number" && l.channel > 0 ? l.channel : null,
      frequency: Number(l.frequency ?? 0),
      signalDbm: typeof l.signal === "number" && l.signal !== 0 ? l.signal : null,
      mac: String(l.mac ?? ""),
      bssid: String(l.bssid ?? ""),
      rxRateKbps: Number(l.rx_statistics?.rate ?? 0),
      txRateKbps: Number(l.tx_statistics?.rate ?? 0),
    }))
    .sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band));
}

export const isMloClient = (m: Member) => clientLinks(m).length > 1;

/** Every band the client is connected on: its MLO links, else its one band. */
export function clientBands(m: Member): Band[] {
  const links = clientLinks(m);
  return links.length ? [...new Set(links.map((l) => l.band))] : [clientBand(m)];
}

export function clientSignalDbm(m: Member): number | null {
  if (isWired(m)) return null;
  // Corteca's top-level signal of an MLO client can belong to another link than its
  // frequency (6 GHz at -21 dBm was really 2.4 GHz); take the link on the band it is filed under.
  const link = clientLinks(m).find((l) => l.frequency === Number(m.frequency ?? 0));
  if (link) return link.signalDbm;
  const s = Number((m as unknown as { signal?: number }).signal ?? m.rssi);
  return Number.isFinite(s) && s !== 0 ? s : null;
}

// Client signal uses the same three-step scale as the links.
export function clientSignal(m: Member): Quality | null {
  if (isWired(m)) return null;
  const s = clientSignalDbm(m);
  if (s == null) return "unknown";
  return s >= -65 ? "good" : s >= -75 ? "fair" : "poor";
}

export function clientName(m: Member): string {
  const host = (m as unknown as { hostname?: string }).hostname;
  return (m.alias || host || m.id).trim();
}
