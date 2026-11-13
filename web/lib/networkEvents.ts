// Corteca's activity log for one network (activity-log `networks/{id}/activity_traces/`):
// reboots, outages, backhaul changes, channel changes, new clients, operator changes.
// Shared by the API route (sanitising) and the page (parsing).

export const EVENT_DAYS = 30;

export interface NetworkEvent {
  id: string;
  /** ms since epoch */
  at: number;
  operation: string;
  /** The AP or client the event is about (uppercase, hyphens). A client's own events carry its MAC here. */
  device: string | null;
  /** USER, AGENT, DEVICE, MESHNETWORK */
  originType: string;
  originId: string | null;
  data: Record<string, string>;
}

export type EventCategory = "status" | "mesh" | "radio" | "clients" | "operator" | "diagnostics" | "console";

export const EVENT_CATEGORIES: { id: EventCategory; label: string; short: string; on: boolean }[] = [
  { id: "status", label: "Online / offline", short: "Online / offline", on: true },
  { id: "mesh", label: "Mesh & backhaul", short: "Mesh", on: true },
  { id: "radio", label: "Channels & radios", short: "Channels", on: true },
  { id: "clients", label: "Clients", short: "Clients", on: true },
  { id: "operator", label: "Operator changes", short: "Operator", on: true },
  // Diagnostics run every few hours; off by default so they don't bury the rest.
  { id: "diagnostics", label: "Diagnostics & logs", short: "Diagnostics", on: false },
  { id: "console", label: "Console sessions", short: "Console sessions", on: false },
];

export const normaliseMac = (mac: string) => mac.trim().toUpperCase().replace(/:/g, "-");

// Raw request payloads (e.g. POST_DEVICEHUB_DEVICES_ROUTER_ITEM) can hold passwords and
// WiFi keys, so they never leave the server; neither does anything that looks like one.
const DROP_KEYS = new Set(["payload", "endPointId"]);
const SECRET_KEY = /pass|pswd|psk|secret|token|credential|wpa|key$/i;
const SECRET_VALUE = /pswd|passw|wpakey|psk=|secret|token/i;

export function sanitiseEventData(data: unknown): Record<string, string> {
  if (!data || typeof data !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (DROP_KEYS.has(k) || SECRET_KEY.test(k) || v == null || typeof v === "object") continue;
    const s = String(v);
    if (SECRET_VALUE.test(s) || s.length > 300) continue;
    out[k] = s;
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** One raw activity trace → NetworkEvent (null if it has no id, time or operation). */
function toEvent(raw: unknown): NetworkEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id), operation = str(r.operation);
  const at = typeof r.date === "string" ? Date.parse(r.date) : typeof r.at === "number" ? r.at : NaN;
  if (!id || !operation || Number.isNaN(at)) return null;
  const data = sanitiseEventData(r.data);
  const origin = (r.origin && typeof r.origin === "object" ? r.origin : {}) as Record<string, unknown>;
  const device = str(r.device_id) ?? str(r.device) ?? str(data.mac);
  return {
    id, at, operation,
    device: device ? normaliseMac(device) : null,
    originType: str(origin.type) ?? str(r.originType) ?? "",
    originId: str(origin.origin_id) ?? str(r.originId),
    data,
  };
}

/** Activity traces (a list, or `{ events }`) → events, de-duplicated, newest first. */
export function parseEvents(raw: unknown): NetworkEvent[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events)
    ? (raw as { events: unknown[] }).events : [];
  const seen = new Set<string>();
  const out: NetworkEvent[] = [];
  for (const row of list) {
    const e = toEvent(row);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out.sort((a, b) => b.at - a.at);
}

export function eventCategory(e: NetworkEvent): EventCategory {
  const op = e.operation;
  // Every console visit logs a sign-in, so they go with the console sessions (hidden by default).
  if (op === "HOME_CONSOLE_LOGS" || op === "SYSTEM_LOGIN") return "console";
  if (/^(PUT|POST|PATCH|DELETE)_/.test(op)) return "operator";
  if (op === "DEV_TIMEZONE_CHANGED") return "diagnostics";
  if (op.startsWith("DEV_") || op.startsWith("NODE_")) return "status";
  if (op.startsWith("MESH_")) return "mesh";
  if (op.includes("CHANNEL") || op.includes("RADIO")) return "radio";
  if (op.includes("MEMBER") || op.startsWith("DEVICE_") || op.includes("STATION")) return "clients";
  return "diagnostics";
}

/** "MESH_BACKHAUL_TYPE_CHANGED" → "Mesh backhaul type changed" (for operations we don't describe). */
export function humaniseOperation(op: string): string {
  const s = op.toLowerCase().replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Corteca's backhaul health word as the diagram shows it ("normal" reads as fair). */
export function healthWord(h: string | undefined): string {
  if (!h) return "unknown";
  return h === "normal" ? "fair" : h;
}

/** Mesh link medium ("wifi-6", "wifi-5high", "ethernet") → band label. */
export function mediumLabel(m: string | undefined): string {
  if (!m) return "unknown";
  if (m === "ethernet") return "Ethernet";
  const band = /^wifi-(\d)(low|high)?$/.exec(m);
  if (!band) return m;
  const ghz = band[1] === "2" ? "2.4" : band[1];
  return `${ghz} GHz${band[2] ? ` ${band[2]}` : ""}`;
}
