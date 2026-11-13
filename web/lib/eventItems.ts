// Corteca's raw activity events → the rows the events views show. Related events are
// folded together: switch-off / lost / reboot / back online on one device become one
// outage, a run of backhaul health changes one "degraded" episode, a burst of channel
// changes one row. Each row keeps its raw events.

import {
  eventCategory, healthWord, humaniseOperation, mediumLabel,
  type EventCategory, type NetworkEvent,
} from "./networkEvents";
import { MINUTE, clock, duration } from "./eventFormat";

export type EventSeverity = "outage" | "degraded" | "info";

export interface EventItem {
  key: string;
  start: number;
  /** End of a span (outage, episode, burst); null for a single moment or an outage with no recovery logged. */
  end: number | null;
  category: EventCategory;
  severity: EventSeverity;
  kind: "outage" | "backhaul" | "channels" | "bands" | "single" | "routine";
  /** With the device's name ("Beacon 9 offline for 9 min"), for network-wide lists. */
  title: string;
  /** Without it ("Offline"), for a device's own panel. */
  subject: string;
  detail: string | null;
  device: string | null;
  /** Oldest first. */
  events: NetworkEvent[];
  /** Label / value rows for the expanded view. */
  fields: [string, string][];
  reboot: boolean;
  /** Only the device's Corteca connection dropped (no switch-off, reboot or mesh offline). */
  cloudOnly: boolean;
  /** Times the backhaul went bad (backhaul episodes). */
  times: number;
}

export interface EventNames {
  /** Short name for titles: nickname, "Gateway", model, client name; else the fallback or MAC. */
  short: (mac: string | null, fallback?: string) => string;
  gatewayMac: string | null;
}

const OUTAGE_START = new Set(["DEV_SWITCH_OFF", "DEV_CONNECTION_LOST", "NODE_OFFLINE", "DEV_REBOOT"]);
const OUTAGE_END = new Set(["DEV_CONNECTION_OK", "NODE_ONLINE"]);
// What follows a recovery on the same device (switch-on, boot report, back on the mesh).
const OUTAGE_TAIL = new Set(["DEV_SWITCH_ON", "DEV_CONNECTION_OK", "NODE_ONLINE", "MESH_BACKHAUL_TYPE_CHANGED"]);
const TAIL_MS = 10 * MINUTE;     // follow-ups absorbed after a recovery
const REOPEN_MS = 5 * MINUTE;    // a new drop this soon after a recovery continues the outage
const BURST_MS = 5 * MINUTE;     // channel changes this close together are one row
const EPISODE_MS = 30 * MINUTE;  // backhaul going bad again this soon is the same episode

function item(e: NetworkEvent, kind: EventItem["kind"], severity: EventSeverity): EventItem {
  return {
    key: e.id, start: e.at, end: null, category: eventCategory(e), severity, kind,
    title: "", subject: "", detail: null, device: e.device, events: [e], fields: [],
    reboot: false, cloudOnly: false, times: 0,
  };
}

/** A backhaul episode keeps its health bookkeeping on the row. */
type BackhaulItem = EventItem & { badSince: number | null; badMs: number; prevHealth?: string; finalHealth?: string };

const words = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const titleCase = (s: string | undefined) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : "unknown");

/** Build all rows, newest first. `events` may be in any order. */
export function buildEventItems(events: NetworkEvent[], names: EventNames): EventItem[] {
  const asc = [...events].sort((a, b) => a.at - b.at);
  const items: EventItem[] = [];
  const open = new Map<string, EventItem>();      // outage in progress, per device
  const closed = new Map<string, EventItem>();    // last recovered outage, per device
  const backhaul = new Map<string, BackhaulItem>();       // latest backhaul episode, per device
  const burst = new Map<string, EventItem>();

  for (const e of asc) {
    const dev = e.device ?? "";
    const op = e.operation;
    // The AP leaving or rejoining the mesh ends a backhaul episode (Corteca logs no
    // separate recovery; NODE_ONLINE carries the new health).
    const ep = backhaul.get(dev);
    if ((op === "NODE_OFFLINE" || op === "NODE_ONLINE") && ep?.badSince != null) {
      ep.badMs += e.at - ep.badSince; ep.badSince = null; ep.end = e.at;
      ep.finalHealth = op === "NODE_OFFLINE" ? "offline" : e.data.new_health;
    }
    const tail = closed.get(dev);
    const inTail = !!tail && tail.end != null && e.at - tail.end <= TAIL_MS;

    if (OUTAGE_START.has(op) || OUTAGE_END.has(op) || op === "DEV_SWITCH_ON") {
      const o = open.get(dev);
      if (o) {
        o.events.push(e);
        if (OUTAGE_END.has(op)) { o.end = e.at; open.delete(dev); closed.set(dev, o); }
        continue;
      }
      if (tail && inTail && OUTAGE_START.has(op) && e.at - tail.end! <= REOPEN_MS) {
        tail.events.push(e); tail.end = null; open.set(dev, tail); closed.delete(dev);
        continue;
      }
      if (tail && inTail && (OUTAGE_TAIL.has(op) || op === "DEV_REBOOT")) {
        tail.events.push(e);
        if (OUTAGE_END.has(op)) tail.end = e.at;
        continue;
      }
      if (OUTAGE_START.has(op)) {
        const o2 = item(e, "outage", "outage");
        open.set(dev, o2); items.push(o2);
        continue;
      }
      items.push(item(e, "routine", "info")); // a reconnect / boot report with no drop logged
      continue;
    }

    if (op === "MESH_BACKHAUL_TYPE_CHANGED") {
      const o = open.get(dev) ?? (inTail ? tail : undefined);
      if (o) { o.events.push(e); continue; }
    }

    if (op === "MESH_BACKHAUL_STATUS_CHANGED") {
      const next = e.data.new_health;
      let b = backhaul.get(dev);
      if (next === "bad") {
        if (b && (b.badSince != null || (b.end != null && e.at - b.end <= EPISODE_MS))) {
          b.events.push(e);
          if (b.badSince == null) { b.badSince = e.at; b.times++; b.end = null; }
        } else {
          b = { ...item(e, "backhaul", "degraded"), badSince: e.at, badMs: 0, prevHealth: e.data.prev_health, times: 1 };
          backhaul.set(dev, b); items.push(b);
        }
        continue;
      }
      if (b && b.badSince != null) {
        b.events.push(e); b.badMs += e.at - b.badSince; b.badSince = null; b.end = e.at; b.finalHealth = next;
        continue;
      }
      items.push(item(e, "routine", "info")); // good ↔ fair: shown with the routine events
      continue;
    }

    // Bursts: channel changes within minutes, backhaul band flips within half an hour.
    const kind = op === "USP_CHANNEL_CHANGE" ? "channels" : op === "MESH_BACKHAUL_TYPE_CHANGED" ? "bands" : null;
    if (kind) {
      const key = `${kind}|${dev}`;
      const c = burst.get(key);
      const last = c?.events.at(-1)?.at ?? 0;
      if (c && e.at - last <= (kind === "channels" ? BURST_MS : EPISODE_MS)) { c.events.push(e); c.end = e.at; continue; }
      const n = item(e, kind, "info");
      burst.set(key, n); items.push(n);
      continue;
    }

    items.push(item(e, "single", "info"));
  }

  for (const it of items) describe(it, names);
  markGatewayOutages(items, names);
  return items.sort((a, b) => b.start - a.start);
}

function describe(it: EventItem, names: EventNames) {
  const name = names.short(it.device, it.events[0].data.name);
  const first = it.events[0];
  const d = first.data;
  switch (it.kind) {
    case "outage": return describeOutage(it, name);
    case "backhaul": {
      const b = it as BackhaulItem;
      it.subject = it.times > 1 ? `Backhaul went bad ${it.times} times` : "Backhaul degraded";
      it.title = it.times > 1 ? `Backhaul to ${name} went bad ${it.times} times` : `Backhaul to ${name} degraded`;
      const recovered = b.badSince == null && it.end != null;
      it.detail = [
        `${healthWord(b.prevHealth)} → bad`,
        !recovered ? "still bad at the last report"
          : b.finalHealth === "offline" ? "then the AP went offline" : `back to ${healthWord(b.finalHealth)}`,
        b.badMs > 0 && (it.times > 1 ? `bad for ${duration(b.badMs)} in total` : `after ${duration(b.badMs)}`),
      ].filter(Boolean).join(" · ");
      return;
    }
    case "channels": {
      const chans = [...new Set(it.events.map((e) => e.data.new_channel).filter(Boolean))];
      it.subject = it.events.length > 1 ? `${it.events.length} channel changes` : `Channel changed to ${chans[0] ?? "?"}`;
      it.title = it.subject;
      it.detail = it.events.length > 1 ? `To channel ${chans.join(", ")}` : null;
      return;
    }
    case "bands": {
      const last = it.events.at(-1)!.data;
      const change = `${mediumLabel(d.prev_medium)} → ${mediumLabel(last.new_medium)}`;
      const n = it.events.length;
      it.subject = n > 1 ? `Backhaul band changed ${n} times` : `Backhaul ${change}`;
      it.title = n > 1 ? `Backhaul to ${name} changed band ${n} times` : `Backhaul to ${name}: ${change}`;
      it.detail = n > 1 ? `${change} at the end` : null;
      return;
    }
    case "routine": {
      if (first.operation === "MESH_BACKHAUL_STATUS_CHANGED") {
        it.subject = `Backhaul ${healthWord(d.prev_health)} → ${healthWord(d.new_health)}`;
        it.title = `Backhaul to ${name}: ${healthWord(d.prev_health)} → ${healthWord(d.new_health)}`;
        return;
      }
      it.subject = first.operation === "NODE_ONLINE" ? "Back on the mesh"
        : first.operation === "DEV_SWITCH_ON" ? "Switched on"
        : d.BOOT === "true" ? "Boot reported" : "Reconnected to Corteca";
      it.title = `${name}: ${it.subject.toLowerCase()}`;
      return;
    }
  }
  describeSingle(it, name);
}

function describeOutage(it: EventItem, name: string) {
  const ops = new Set(it.events.map((e) => e.operation));
  const reboot = it.events.find((e) => e.operation === "DEV_REBOOT");
  const switchedOff = ops.has("DEV_SWITCH_OFF"), meshOff = ops.has("NODE_OFFLINE");
  it.reboot = !!reboot;
  it.cloudOnly = !reboot && !switchedOff && !meshOff;
  const span = it.end != null ? duration(it.end - it.start) : null;
  const forSpan = span ? ` for ${span}` : "";
  if (reboot && switchedOff && it.end != null && it.end - it.start > 5 * MINUTE) {
    it.subject = `Switched off${forSpan}, then rebooted`;
  } else if (reboot) it.subject = "Rebooted";
  else if (switchedOff) it.subject = `Switched off${forSpan}`;
  else if (it.cloudOnly) it.subject = `Lost its Corteca connection${forSpan}`;
  else it.subject = `Offline${forSpan}`;
  if (it.end == null) it.subject += " (no recovery logged)";
  it.title = `${name} ${it.subject.charAt(0).toLowerCase()}${it.subject.slice(1)}`;

  const typeChange = it.events.find((e) => e.operation === "MESH_BACKHAUL_TYPE_CHANGED");
  const back = [...it.events].reverse().find((e) => e.operation === "NODE_ONLINE");
  const r = reboot?.data;
  it.detail = [
    r?.reason && words(r.reason),
    it.end != null && `back ${clock(it.end)}`,
    typeChange && `came back on ${mediumLabel(typeChange.data.new_medium)} backhaul (was ${mediumLabel(typeChange.data.prev_medium)})`,
    back?.data.new_health && back.data.new_health !== "good" && `backhaul ${healthWord(back.data.new_health)}`,
  ].filter(Boolean).join(" · ") || null;
  const timeOff = Number(r?.time_off);
  it.fields = [
    ["Reason", r?.reason ? words(r.reason) : ""],
    ["Role", r?.role === "Controller" ? "Controller (gateway)" : r?.role === "Agent" ? "Agent (Beacon)" : r?.role ?? ""],
    ["Time off", timeOff > 0 ? duration(timeOff) : ""],
    ["Model", r?.model ?? ""],
    ["Software", r?.Software_version ?? ""],
    ["Corteca events", [...ops].join(" · ")],
  ].filter(([, v]) => v) as [string, string][];
}

function describeSingle(it: EventItem, name: string) {
  const e = it.events[0], d = e.data;
  const set = (subject: string, title: string, detail: string | null = null) => { it.subject = subject; it.title = title; it.detail = detail; };
  switch (e.operation) {
    case "NEW_MEMBER_IN_NETWORK": return set("Joined the network", `New client joined: ${name}`, d.name && d.name !== name ? `First seen as "${d.name}"` : e.device);
    case "DEVICE_TYPE_CHANGE": return set("Device type changed", `${name}: device type changed`,
      `${titleCase(d.prev_type)} → ${titleCase(d.type)}${d.from_cpe === "true" ? " · detected by the gateway" : ""}`);
    case "DEVICE_FRIENDLYNAME_CHANGE": return set("Name changed", `${name}: name changed`,
      `${d.prev_name ?? "?"} → "${d.name ?? "?"}"${d.from_cpe === "true" ? " · from the gateway" : ""}`);
    case "PUT_DEVICEHUB_DEVICES_WIFI_RADIOS_ITEM": {
      const bands = (d.bands ?? "").match(/\d+(\.\d+)?ghz/gi)?.map((b) => b.replace(/ghz/i, " GHz")).join(", ");
      return set("Radio settings changed", "Radio settings changed by an operator", [
        bands, d.channel && `channel ${d.channel}`, d.operating_bandwidth?.replace("MHz", " MHz"),
        d.auto && `auto channel ${d.auto === "true" ? "on" : "off"}`, d.enabled === "false" && "radio off",
      ].filter(Boolean).join(" · ") || null);
    }
    case "POST_DEVICEHUB_DEVICES_ROUTER_ITEM": return set("Management request", "Gateway management request by an operator", d.router ? `Target: ${d.router}` : null);
    case "SYSTEM_LOGIN": return set("Operator signed in", "Operator signed in", e.originId);
    case "HOME_CONSOLE_LOGS": {
      const verb = d.event === "SESSION_STOP" ? "ended" : "started";
      return set(`Console session ${verb}`, `Console session ${verb}`, d.name ?? null);
    }
    case "MEASURES_DIAGNOSTICS_UPDATED": {
      const checks = Object.entries(d).filter(([, v]) => v === "true").map(([k]) => k.replace(/_/g, " "));
      return set("Diagnostics updated", "Diagnostics updated", checks.join(" · ") || null);
    }
    case "UBUS_LOG_UPLOAD": return set("Logs uploaded", `Logs uploaded from ${name}`, d.status ?? null);
    case "DEV_TIMEZONE_CHANGED": return set("Time zone changed", `${name}: time zone changed`, d.time_zone ?? null);
  }
  const what = humaniseOperation(e.operation);
  set(what, e.device ? `${what} · ${name}` : what);
}

/** A Beacon outage that starts with a gateway outage says so. */
function markGatewayOutages(items: EventItem[], names: EventNames) {
  const gw = names.gatewayMac;
  if (!gw) return;
  const gwOutages = items.filter((i) => i.kind === "outage" && i.device === gw && !i.cloudOnly);
  for (const it of items) {
    if (it.kind !== "outage" || it.device === gw) continue;
    const withGw = gwOutages.some((g) => Math.abs(g.start - it.start) <= 3 * MINUTE || (it.start >= g.start && (g.end == null || it.start <= g.end)));
    if (!withGw) continue;
    it.detail = ["Went down with the gateway", it.detail].filter(Boolean).join(" · ");
    // With the gateway down, a Beacon is offline even if Corteca only logged its connection drop.
    if (it.cloudOnly) {
      it.cloudOnly = false;
      it.subject = it.subject.replace("Lost its Corteca connection", "Offline");
      it.title = it.title.replace("lost its Corteca connection", "offline");
    }
  }
}
