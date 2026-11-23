// Corteca's device classification per client ("member profiles"): what the Corteca console shows
// as a client's Type, Manufacturer, Model and Mobility. Read from
// GET /station-profiles/networks/{id}/member_profiles (worked out from the console's code,
// 2026-11-23): one record per client MAC the network has seen, connected or not, e.g.
// { member_id, type: "MEDIA_PLAYER", manufacturer: "Roku", model_name: "9102R",
//   operating_system: "Roku OS", mobility: "STATIC", name, host_name, type_set_by: "CPE" | "FING" | "SYSTEM",
//   type_confidence: 40 }. `type_custom` ("Streaming Dongle") exists but the console doesn't show it.

export interface MemberProfile {
  mac: string;
  /** Corteca's type code, e.g. "MEDIA_PLAYER". */
  type: string;
  manufacturer: string;
  model: string;
  os: string;
  /** "STATIC" | "MOBILE" (from the type). */
  mobility: string;
  /** Who classified it: CPE (the gateway), FING (fingerprinting service), SYSTEM, a user… */
  setBy: string;
  confidence: number | null;
}

export type MemberProfiles = Map<string, MemberProfile>;

export const profileKey = (mac: string) => mac.toUpperCase().replace(/[:\-]/g, "");

const str = (v: unknown) => (typeof v === "string" && v.trim() && v !== "null" ? v.trim() : "");

export function parseMemberProfile(raw: unknown): MemberProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const mac = str(r.member_id);
  if (!mac) return null;
  return {
    mac: mac.toUpperCase().replace(/:/g, "-"),
    type: str(r.type),
    manufacturer: str(r.manufacturer),
    model: str(r.model_name),
    os: str(r.operating_system),
    mobility: str(r.mobility),
    setBy: str(r.type_set_by),
    confidence: typeof r.type_confidence === "number" ? r.type_confidence : null,
  };
}

/** The console's English labels for Corteca's type codes (its en.json, GET /station-profiles/types). */
const TYPE_LABEL: Record<string, string> = {
  WEARABLE: "Wearable", SECURITY: "Security", STREAMING_DEVICE: "Streaming device", SMART_HOME: "Smart home",
  SERVER: "Server", PC: "Desktop", VOICE_ASSISTANT: "Voice assistant", MEDIA_PLAYER: "Media player",
  TABLET: "Tablet", VIDEO: "Video", PRINTER_SCANNER: "Printer & scanner", OTHER_STATIC: "Other static",
  CAMERA: "Camera", NETWORK: "Network", TV: "TV", VEHICLE: "Vehicle", PHONE: "Phone", HEALTH: "Health",
  ROBOT: "Robot", LAPTOP: "Laptop", WIFI_EXTENDER: "WiFi extender", AUDIO: "Audio", CONSOLE: "Game console",
  OTHER: "Other", APPLIANCE: "Appliance", SENSOR: "Sensor",
};

export function typeLabel(type: string | undefined): string {
  if (!type) return "";
  return TYPE_LABEL[type] ?? type.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export const mobilityLabel = (m: string | undefined) => (m === "STATIC" ? "Static" : m === "MOBILE" ? "Mobile" : m ?? "");

const SET_BY: Record<string, string> = { CPE: "the gateway", FING: "Fing device recognition", SYSTEM: "Corteca", USER: "a user" };

/** Hover text for the Type cell: who classified it and how sure. */
export function typeSource(p: MemberProfile): string {
  const by = SET_BY[p.setBy] ?? (p.setBy ? p.setBy.toLowerCase() : "");
  return [by && `Classified by ${by}`, p.confidence != null && `${p.confidence}% confidence`].filter(Boolean).join(" · ");
}
