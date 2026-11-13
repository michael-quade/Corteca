// Filters, totals, per-day counts, per-AP stats and the diagram badge for the network
// events views. Works on the rows from buildEventItems().

import type { EventCategory } from "./networkEvents";
import type { EventItem, EventSeverity } from "./eventItems";
import { DAY, ago, startOfDay } from "./eventFormat";

export type EventPeriod = 1 | 7 | 30;
export const EVENT_PERIODS: { days: EventPeriod; label: string }[] = [
  { days: 1, label: "24 h" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" },
];

export interface EventFilter {
  period: EventPeriod;
  categories: Set<EventCategory>;
  /** Only rows about this AP / client. */
  device: string | null;
  /** Show reconnects / boot reports with no drop logged. */
  routine: boolean;
}

/** The row touches the last `days` (an outage that began earlier but ended inside counts). */
export const inPeriod = (it: EventItem, now: number, days: number) => (it.end ?? it.start) >= now - days * DAY;

/** Period + device + routine, before the category chips (the chips show counts from this). */
export function scopeItems(items: EventItem[], f: Omit<EventFilter, "categories">, now: number): EventItem[] {
  return items.filter((it) => inPeriod(it, now, f.period) && (!f.device || it.device === f.device) && (f.routine || it.kind !== "routine"));
}

export function categoryCounts(items: EventItem[]): Map<EventCategory, number> {
  const out = new Map<EventCategory, number>();
  for (const it of items) out.set(it.category, (out.get(it.category) ?? 0) + 1);
  return out;
}

export interface EventSummary {
  reboots: number;
  rebootsBy: Map<string, number>;
  outages: number;
  outageMs: number;
  degraded: number;
  degradedDevices: Set<string>;
  newClients: number;
  lastNewClient: EventItem | null;
}

const isOutage = (it: EventItem) => it.kind === "outage" && !it.cloudOnly;

export function summarise(items: EventItem[], now: number): EventSummary {
  const s: EventSummary = {
    reboots: 0, rebootsBy: new Map(), outages: 0, outageMs: 0, degraded: 0,
    degradedDevices: new Set(), newClients: 0, lastNewClient: null,
  };
  for (const it of items) {
    if (it.kind === "outage") {
      const n = it.events.filter((e) => e.operation === "DEV_REBOOT").length;
      if (n && it.device) { s.reboots += n; s.rebootsBy.set(it.device, (s.rebootsBy.get(it.device) ?? 0) + n); }
      if (isOutage(it)) { s.outages++; s.outageMs += (it.end ?? now) - it.start; }
    }
    if (it.kind === "backhaul") { s.degraded += it.times; if (it.device) s.degradedDevices.add(it.device); }
    if (it.events[0].operation === "NEW_MEMBER_IN_NETWORK") {
      s.newClients++;
      if (!s.lastNewClient || it.start > s.lastNewClient.start) s.lastNewClient = it;
    }
  }
  return s;
}

export interface DayBucket { day: number; outage: number; degraded: number; info: number }

/** One bucket per calendar day of the period, oldest first. */
export function dayBuckets(items: EventItem[], now: number, days: number): DayBucket[] {
  const today = startOfDay(now);
  const n = days === 1 ? 2 : days + 1;
  const buckets: DayBucket[] = [];
  for (let i = n - 1; i >= 0; i--) buckets.push({ day: startOfDay(today - i * DAY + DAY / 2), outage: 0, degraded: 0, info: 0 });
  const index = new Map(buckets.map((b, i) => [b.day, i]));
  for (const it of items) {
    const i = index.get(startOfDay(it.start));
    if (i != null) buckets[i][it.severity]++;
  }
  return buckets;
}

export interface ApEventStats {
  outages: number;
  outageMs: number;
  reboots: number;
  lastReboot: EventItem | null;
  degraded: number;
  bandChanges: number;
  bandChange: string | null;
}

export function apStats(items: EventItem[], now: number): ApEventStats {
  const s: ApEventStats = { outages: 0, outageMs: 0, reboots: 0, lastReboot: null, degraded: 0, bandChanges: 0, bandChange: null };
  const changes = new Map<string, number>();
  for (const it of items) {
    if (isOutage(it)) { s.outages++; s.outageMs += (it.end ?? now) - it.start; }
    if (it.reboot) { s.reboots++; if (!s.lastReboot || it.start > s.lastReboot.start) s.lastReboot = it; }
    if (it.kind === "backhaul") s.degraded += it.times;
    for (const e of it.events) {
      if (e.operation !== "MESH_BACKHAUL_TYPE_CHANGED") continue;
      s.bandChanges++;
      const key = `${e.data.prev_medium}→${e.data.new_medium}`;
      changes.set(key, (changes.get(key) ?? 0) + 1);
    }
  }
  const top = [...changes.entries()].sort((a, b) => b[1] - a[1])[0];
  s.bandChange = top ? top[0] : null;
  return s;
}

export interface TimelineSegment { start: number; end: number; severity: EventSeverity }

/** Offline and backhaul-bad spans of one device, clipped to the period. */
export function timelineSegments(items: EventItem[], from: number, now: number): TimelineSegment[] {
  return items
    .filter((it) => isOutage(it) || it.kind === "backhaul")
    .map((it) => ({ start: Math.max(from, it.start), end: Math.min(now, it.end ?? now), severity: it.severity }))
    .filter((s) => s.end >= from);
}

/** Rows counted on the top bar: what happened in the last 24 h (no console sessions, no routine reports). */
export function eventsToday(items: EventItem[], now: number): number {
  return items.filter((it) => inPeriod(it, now, 1) && it.kind !== "routine" && it.category !== "console" && it.category !== "diagnostics").length;
}

// ── Diagram badge ──────────────────────────────────────────────

export interface EventAck {
  /** Badge hidden for outages that began before this. */
  ackAt?: number;
  /** Badge hidden until then; -1 = until turned back on. */
  silencedUntil?: number;
}

export const BADGE_DAYS = 30;

export const isSilenced = (ack: EventAck | undefined, now: number) =>
  !!ack?.silencedUntil && (ack.silencedUntil === -1 || ack.silencedUntil > now);

export interface ApBadge { label: string; recent: boolean; isNew: boolean; outages: EventItem[] }

/** Reboots / offline episodes of an AP in the last BADGE_DAYS, since it was last acknowledged. */
export function apBadge(items: EventItem[], ack: EventAck | undefined, now: number): ApBadge | null {
  if (isSilenced(ack, now)) return null;
  const outages = items.filter((it) => isOutage(it) && inPeriod(it, now, BADGE_DAYS) && (!ack?.ackAt || it.start > ack.ackAt));
  if (!outages.length) return null;
  const latest = outages.reduce((a, b) => (b.start > a.start ? b : a));
  const verb = latest.reboot ? "rebooted" : "offline";
  const isNew = !!ack?.ackAt;
  const one = `${isNew ? verb : verb.charAt(0).toUpperCase() + verb.slice(1)} ${ago(latest.start, now)}`;
  const label = isNew
    ? `New · ${outages.length === 1 ? one : `${outages.length} outages`}`
    : outages.length === 1 ? one : `${outages.length}× offline · ${BADGE_DAYS} days`;
  return { label, recent: now - latest.start < DAY, isNew, outages };
}
