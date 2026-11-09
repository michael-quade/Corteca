// A client's roaming history from Corteca's per-client RSSI history
// (GET /dashboard-bff/networks/{id}/members/{mac}/rssi), turned into association sessions.
//
// What the endpoint returns (checked on demo2, 2026-11-09): `{ init_date, end_date, events[] }`,
// oldest first. Operations: ASSOCIATED (AP `device_id`, `band` "2.4GHz" / "5GHz" / "5GHz_high",
// `channel`, `rssi_value`), DISASSOCIATED (`reason_code`, rssi 0), RSSI_CHANGED (about hourly
// samples while connected; one at `init_date` = already connected when the window opens) and
// DEV_SWITCH_OFF (that AP powered off). An ASSOCIATED while already connected is a roam — no
// DISASSOCIATED comes in between. Rows can repeat. MLO clients carry `links[]` (per link
// `frequency`, `rssi_value`, sometimes `channel`) and no top-level band. Without from/to
// Corteca returns 7 days; history goes back roughly 2.5 weeks.

export const ROAMING_DAYS = 14;
/** A reconnect within this long after a disconnect counts as moving, not as a drop. */
const ROAM_GAP_MS = 2 * 60_000;

export interface RssiLink { bssid?: string; channel?: number; frequency?: number; mac?: string; rssi_value?: number }
export interface RssiEvent {
  operation: string;
  device_id: string;
  event_date: string;
  band?: string;
  channel?: number;
  rssi_value?: number;
  reason_code?: number;
  links?: RssiLink[];
}
export interface RssiHistory { from: number; to: number; events: RssiEvent[] }

export type SessionEnd =
  | { kind: "roamed" }
  | { kind: "disconnected"; reasonCode: number | null }
  | { kind: "apOff" }
  | { kind: "ongoing" };

export interface RoamSession {
  ap: string;
  band: string | null;
  channel: number | null;
  mlo?: boolean;
  start: number;
  end: number;
  /** Already connected when the window opened (no association seen). */
  startedBefore: boolean;
  /** Began by moving off another AP or band (not a fresh connect). */
  roam: boolean;
  endedBy: SessionEnd;
  joinRssi: number | null;
  minRssi: number | null;
  /** Taken from the live network data, not from Corteca's history. */
  live?: boolean;
}

export interface RoamSummary {
  apMoves: number;
  bandMoves: number;
  disconnects: number;
  /** Connected time per AP MAC (ms), largest first. */
  timePerAp: { ap: string; ms: number }[];
}

const toMac = (v: unknown) => String(v ?? "").replace(/:/g, "-").toUpperCase();

export function parseRssiHistory(body: unknown): RssiHistory | null {
  const b = body as { init_date?: unknown; end_date?: unknown; events?: unknown } | null;
  if (!b || !Array.isArray(b.events)) return null;
  const to = Date.parse(String(b.end_date ?? "")) || Date.now();
  const from = Date.parse(String(b.init_date ?? "")) || to - ROAMING_DAYS * 86_400_000;
  const events = (b.events as RssiEvent[]).filter((e) => e && typeof e.operation === "string" && !Number.isNaN(Date.parse(e.event_date)));
  return { from, to, events };
}

function bandOfFrequency(mhz: number): string | null {
  if (mhz >= 5925) return "6 GHz";
  if (mhz >= 4900) return "5 GHz";
  if (mhz >= 2400) return "2.4 GHz";
  return null;
}

const BAND_ORDER = ["6 GHz", "5 GHz", "2.4 GHz"];
const isMlo = (e: RssiEvent) => (e.links?.length ?? 0) > 0;
const linkBands = (e: RssiEvent) =>
  BAND_ORDER.filter((b) => (e.links ?? []).some((l) => bandOfFrequency(Number(l.frequency ?? 0)) === b));

/**
 * MLO → its links' bands, "6 GHz + 2.4 GHz" (the top-level `band`, when present, names one link);
 * otherwise "5GHz_high" → "5 GHz" (client-facing bands keep one 5 GHz).
 */
function eventBand(e: RssiEvent): string | null {
  const links = linkBands(e);
  if (links.length) return links.join(" + ");
  const b = e.band?.toLowerCase();
  if (b) return b.startsWith("2.4") ? "2.4 GHz" : b.startsWith("5") ? "5 GHz" : b.startsWith("6") ? "6 GHz" : e.band!;
  return null;
}

/**
 * An MLO association is sometimes filed twice within a second: by the Beacon the client joined
 * (links with frequencies) and by the gateway (the same links, no frequencies). Drop the latter.
 */
function isGhostAssociation(e: RssiEvent, all: RssiEvent[]): boolean {
  if (e.operation !== "ASSOCIATED" || !isMlo(e) || linkBands(e).length) return false;
  const t = Date.parse(e.event_date);
  return all.some((o) => o !== e && o.operation === "ASSOCIATED" && linkBands(o).length > 0 && Math.abs(Date.parse(o.event_date) - t) <= 5_000);
}

const rssiOf = (e: RssiEvent) => (e.rssi_value && e.rssi_value < 0 ? e.rssi_value : null);

/** Association sessions, oldest first. `gatewayMac`: its DEV_SWITCH_OFF ends a session on any AP. */
export function roamSessions(history: RssiHistory, gatewayMac?: string): RoamSession[] {
  const seen = new Set<string>();
  const events = [...history.events]
    .sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date))
    .filter((e) => {
      const key = `${e.event_date}|${e.operation}|${e.device_id}|${e.rssi_value}`;
      return !seen.has(key) && seen.add(key);
    })
    .filter((e, _, all) => !isGhostAssociation(e, all));

  const sessions: RoamSession[] = [];
  let open: RoamSession | null = null;
  const close = (t: number, endedBy: SessionEnd) => {
    if (open) sessions.push({ ...open, end: Math.max(t, open.start), endedBy });
    open = null;
  };
  const begin = (e: RssiEvent, t: number, associated: boolean) => {
    const ap = toMac(e.device_id), band = eventBand(e), rssi = rssiOf(e);
    const prev = sessions[sessions.length - 1];
    const changed = !!prev && (prev.ap !== ap || (prev.band !== band && !(prev.mlo && isMlo(e))));
    const moved = changed && (prev.endedBy.kind === "roamed" || t - prev.end <= ROAM_GAP_MS);
    open = {
      ap, band, channel: isMlo(e) ? null : e.channel ?? null, mlo: isMlo(e), start: t, end: t,
      startedBefore: !associated && t - history.from < 60_000,
      roam: moved, endedBy: { kind: "ongoing" }, joinRssi: rssi, minRssi: rssi,
    };
  };

  for (const e of events) {
    const t = Date.parse(e.event_date);
    const ap = toMac(e.device_id);
    const cur = open as RoamSession | null;
    switch (e.operation) {
      case "ASSOCIATED":
        // Re-association to the same AP and band while connected: the same session. An MLO
        // client's link set changes as it re-associates — that isn't a band change either.
        if (cur && cur.ap === ap && (cur.band === eventBand(e) || (cur.mlo && isMlo(e)))) {
          if (isMlo(e)) cur.band = eventBand(e) ?? cur.band;
          break;
        }
        if (cur) close(t, { kind: "roamed" });
        begin(e, t, true);
        break;
      case "RSSI_CHANGED": {
        if (cur && cur.ap === ap) {
          const r = rssiOf(e);
          if (r != null) cur.minRssi = cur.minRssi == null ? r : Math.min(cur.minRssi, r);
          cur.band ??= eventBand(e);
          cur.channel ??= e.channel ?? null;
          break;
        }
        // A sample from another AP without an association: Corteca missed the move.
        if (cur) close(t, { kind: "roamed" });
        begin(e, t, false);
        break;
      }
      case "DISASSOCIATED":
        if (cur) close(t, { kind: "disconnected", reasonCode: e.reason_code || null });
        break;
      case "DEV_SWITCH_OFF":
        if (cur && (cur.ap === ap || ap === gatewayMac)) close(t, { kind: "apOff" });
        break;
    }
  }
  const last = open as RoamSession | null;
  if (last) sessions.push({ ...last, end: Math.max(history.to, last.start) });
  return sessions;
}

export interface LiveConnection { ap: string; band: string | null; channel: number | null; since: number | null; rssi: number | null }

/**
 * Adds the connection live data (MCP) shows now when the history doesn't end on it — Corteca
 * sometimes misses the reconnect after an AP restart, leaving the client looking disconnected.
 */
export function withLiveConnection(sessions: RoamSession[], live: LiveConnection | null, now: number): RoamSession[] {
  const last = sessions[sessions.length - 1];
  if (!live || (last?.endedBy.kind === "ongoing" && last.ap === live.ap)) return sessions;
  // History still has the client elsewhere: it moved. Otherwise it reconnected after the last end.
  const moved = last?.endedBy.kind === "ongoing";
  if (!moved && live.since == null) return sessions;
  const floor = last ? (moved ? last.start : last.end) : 0;
  const start = Math.max(live.since ?? floor, floor);
  if (start >= now) return sessions;
  const earlier = moved ? [...sessions.slice(0, -1), { ...last, end: start, endedBy: { kind: "roamed" } as const }] : sessions;
  return [
    ...earlier,
    { ap: live.ap, band: live.band, channel: live.channel, start, end: now, startedBefore: false, roam: moved, endedBy: { kind: "ongoing" }, joinRssi: live.rssi, minRssi: live.rssi, live: true },
  ];
}

/** Sessions overlapping [from, …), clipped to start no earlier than `from`. */
export function sessionsSince(sessions: RoamSession[], from: number): RoamSession[] {
  return sessions
    .filter((s) => s.end > from)
    .map((s) => (s.start < from ? { ...s, start: from, startedBefore: true, roam: false } : s));
}

export function summarise(sessions: RoamSession[]): RoamSummary {
  const time = new Map<string, number>();
  let apMoves = 0, bandMoves = 0, disconnects = 0;
  sessions.forEach((s, i) => {
    time.set(s.ap, (time.get(s.ap) ?? 0) + (s.end - s.start));
    const prev = sessions[i - 1];
    if (s.roam && prev) {
      if (prev.ap !== s.ap) apMoves++;
      else bandMoves++;
    }
    // A disconnect followed straight away by a move isn't a drop.
    const next = sessions[i + 1];
    if (s.endedBy.kind === "disconnected" && !next?.roam) disconnects++;
  });
  const timePerAp = [...time].map(([ap, ms]) => ({ ap, ms })).sort((a, b) => b.ms - a.ms);
  return { apMoves, bandMoves, disconnects, timePerAp };
}
