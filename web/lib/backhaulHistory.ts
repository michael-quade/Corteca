// A wireless Beacon's backhaul history: Corteca keeps the same per-station association / RSSI
// history it keeps for clients (GET …/members/{MAC}/rssi) for each Beacon's backhaul station —
// one per backhaul radio, so a tri-band Beacon has two (5 GHz high and 6 GHz). Looked up by the
// Beacon's own MAC there is almost nothing; by the station MAC there is the full history, with the
// parent AP as `device_id`. Checked on demo2 2026-11-13: A8-FB-40-AE-F5-C3's Beacon 52-E3 switched
// parent ~29 times in 2 weeks; 60-98-49-FF-9F-60's Beacon 9 dropped 3× and moved 5 GHz → 6 GHz.
// MLO (WiFi 7 multi-link) backhaul: Corteca files the history under the backhaul MLD MAC (MCP's
// `mlds` entry with role "BSTA"), joins carrying `links[]` per band — each join filed twice in the
// same second, once by another AP without link frequencies (dropped like MLO clients' ghost joins).
// The per-radio histories then only add sparse single-link polls (-75 dBm, ~5 min granularity),
// shown as extra bars but not counted. A8-FB-40-AE-F5-C3 Beacon 52-E3: MLD 38 joins / 19 drops.
// Per-radio joins often carry exactly -75 dBm (most joins on A8-FB, next to real -40 / -68 readings), so
// that value on a join is read as "no reading". Disconnects carry no reason code.

import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { isEthernet } from "@/web/lib/topologyFlow";
import { labelRadios } from "@/web/lib/wifiRadios";
import {
  roamSessions, withLiveConnection, type LiveConnection, type RoamSession, type RoamSummary, type RssiHistory,
} from "@/web/lib/roamingHistory";

/**
 * One backhaul station of a Beacon: its radio's band ("5 GHz high") and MAC (AA-BB-…, for the
 * history route); `mlo` = the multi-link (MLD) station spanning the radios, `band` its bands joined.
 */
export interface BackhaulRadio { band: string; staMac: string; mlo?: boolean }

const dashed = (mac: string) => mac.toUpperCase().replace(/:/g, "-");
const BAND_ORDER = ["6 GHz", "5 GHz high", "5 GHz", "5 GHz low", "2.4 GHz"];
const bandRank = (b: string) => { const i = BAND_ORDER.indexOf(b); return i < 0 ? BAND_ORDER.length : i; };

/**
 * A Beacon's backhaul stations: from the gateway's radios (`backhaulStaMac`), plus the station
 * the live link uses (MCP's endpoint, also each MLO band's) when the gateway read is missing.
 * Fastest band first. Empty for the gateway and for Beacons that never back-haul over WiFi.
 */
export function backhaulRadios(ap: McpAccessPoint, uplink: McpBackhaulLink | undefined): BackhaulRadio[] {
  const out = new Map<string, BackhaulRadio>();
  for (const r of labelRadios(ap.radios ?? [])) {
    if (r.backhaulStaMac) out.set(dashed(r.backhaulStaMac), { band: r.band, staMac: dashed(r.backhaulStaMac) });
  }
  if (uplink && !isEthernet(uplink)) {
    const bands = uplink.mloBands?.length ? uplink.mloBands : [{ band: uplink.band, staMac: uplink.childStaMac }];
    for (const b of bands) {
      if (b.staMac && !out.has(dashed(b.staMac))) out.set(dashed(b.staMac), { band: b.band ?? "WiFi", staMac: dashed(b.staMac) });
    }
  }
  const radios = [...out.values()].sort((a, b) => bandRank(a.band) - bandRank(b.band));
  if (!ap.backhaulMld) return radios;
  const bands = radios.map((r) => r.band).filter((b) => b !== "WiFi");
  return [{ band: bands.length > 1 ? bands.join(" + ") : "MLO", staMac: dashed(ap.backhaulMld), mlo: true }, ...radios];
}

/** The fixed -75 dBm on joins isn't a reading. */
export const FILLER_RSSI = -75;

function withoutFillerRssi(h: RssiHistory): RssiHistory {
  return { ...h, events: h.events.map((e) => (e.operation === "ASSOCIATED" && e.rssi_value === FILLER_RSSI ? { ...e, rssi_value: undefined } : e)) };
}

/** Where the live data has this station now, if the current uplink runs over it. */
function liveOn(radio: BackhaulRadio, uplink: McpBackhaulLink | undefined): LiveConnection | null {
  if (!uplink || isEthernet(uplink)) return null;
  if (radio.mlo) {
    return uplink.mloBands?.length
      ? { ap: dashed(uplink.parentMac), band: null, channel: null, since: null, rssi: uplink.rssiDbm }
      : null;
  }
  const stas = (uplink.mloBands?.length ? uplink.mloBands.map((b) => b.staMac) : [uplink.childStaMac]).filter(Boolean).map((m) => dashed(m!));
  if (!stas.includes(radio.staMac)) return null;
  return { ap: dashed(uplink.parentMac), band: radio.band, channel: uplink.channel ?? null, since: null, rssi: uplink.rssiDbm };
}

/**
 * One station's connections. A radio's sessions take its own band label ("5 GHz high", not
 * "5 GHz"); MLO sessions keep the bands of their links ("6 GHz + 5 GHz"). `live` = add the
 * connection the live data shows when Corteca's history doesn't end on it.
 */
export function laneSessions(
  history: RssiHistory, radio: BackhaulRadio, network: McpNetwork, uplink: McpBackhaulLink | undefined, live: boolean,
): RoamSession[] {
  const gateway = network.aps.find((a) => a.role === "root");
  const raw = roamSessions(radio.mlo ? history : withoutFillerRssi(history), gateway ? dashed(gateway.mac) : undefined);
  // An MLO session spans bands, so one link's channel (from a signal sample) would mislead.
  const banded = radio.mlo ? raw.map((s) => ({ ...s, channel: null })) : raw.map((s) => ({ ...s, band: radio.band }));
  const sessions = live ? withLiveConnection(banded, liveOn(radio, uplink), history.to) : banded;
  // A Beacon takes minutes to rejoin, so (unlike a client's 2-minute rule) joining a different
  // parent than last time is a move whatever the gap.
  return sessions.map((s, i) => ({ ...s, roam: i > 0 && sessions[i - 1].ap !== s.ap }));
}

/** Joined time per parent: both radios are often joined at once, so overlapping time counts once. */
function unionTime(sessions: RoamSession[]): Map<string, number> {
  const byAp = new Map<string, [number, number][]>();
  for (const s of sessions) byAp.set(s.ap, [...(byAp.get(s.ap) ?? []), [s.start, s.end]]);
  const time = new Map<string, number>();
  for (const [ap, spans] of byAp) {
    spans.sort((a, b) => a[0] - b[0]);
    let total = 0, start = -Infinity, end = -Infinity;
    for (const [s, e] of spans) {
      if (s > end) { if (end > start) total += end - start; start = s; end = e; } else end = Math.max(end, e);
    }
    if (end > start) total += end - start;
    time.set(ap, total);
  }
  return time;
}

/**
 * Totals over the counted stations: parent changes (a join to another parent than the last, a
 * drop in between or not) and drops (every one — a Beacon that drops is an outage even if it
 * rejoins elsewhere) add up; time per parent counts overlaps once.
 */
export function summariseLanes(lanes: RoamSession[][]): RoamSummary {
  const time = unionTime(lanes.flat());
  return {
    apMoves: lanes.reduce((n, l) => n + l.filter((s, i) => i > 0 && s.roam).length, 0),
    bandMoves: 0,
    disconnects: lanes.reduce((n, l) => n + l.filter((s) => s.endedBy.kind === "disconnected").length, 0),
    timePerAp: [...time].map(([ap, ms]) => ({ ap, ms })).sort((a, b) => b.ms - a.ms),
  };
}
