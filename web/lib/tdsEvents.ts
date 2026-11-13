// TDS Network Events RCR: the network events rows (buildEventItems) with a P1–P4 level,
// TDS categories (adds "Firmware & config") and wording for operations the standard
// events popout shows by their raw name. Works on copies; the standard rows are untouched.

import type { EventItem, EventNames } from "./eventItems";
import { humaniseOperation, mediumLabel, type NetworkEvent } from "./networkEvents";
import { eventPriority, isFailure, itemPriority, type Priority } from "./eventPriority";

export type TdsGroup = "status" | "mesh" | "radio" | "clients" | "maintenance" | "operator" | "diagnostics" | "console";

export const TDS_GROUPS: { id: TdsGroup; label: string; short: string; on: boolean; hint: string }[] = [
  { id: "status", label: "Online / offline", short: "Online / offline", on: true, hint: "Lost connections, reboots, switch-offs, factory resets, APs off the mesh" },
  { id: "mesh", label: "Mesh & backhaul", short: "Mesh", on: true, hint: "Backhaul health and band, new Beacons" },
  { id: "radio", label: "Channels & radios", short: "Channels", on: true, hint: "Channel changes and interference alarms" },
  { id: "clients", label: "Clients", short: "Clients", on: true, hint: "New, removed, renamed and re-typed devices" },
  { id: "maintenance", label: "Firmware & config", short: "Firmware", on: true, hint: "Firmware upgrades and configuration pushes" },
  { id: "operator", label: "Operator & app", short: "Operator", on: true, hint: "Care-agent support actions, WiFi password resets, app and account changes" },
  { id: "diagnostics", label: "Diagnostics & logs", short: "Diagnostics", on: false, hint: "Speed tests and diagnostics, log uploads, time zone" },
  { id: "console", label: "Console sessions", short: "Console", on: false, hint: "Corteca Console sessions and operator sign-ins" },
];

export interface TdsItem extends EventItem {
  priority: Priority;
  group: TdsGroup;
}

export function tdsGroup(e: NetworkEvent): TdsGroup {
  const op = e.operation;
  if (op === "HOME_CONSOLE_LOGS" || op === "SYSTEM_LOGIN") return "console";
  if (op === "DEV_FIRMWARE_UPGRADED" || op === "DEV_CONFIG_PUSH" || /FIRMWARE|CONFIG|BACKUP|RESTORE/.test(op)) return "maintenance";
  if (e.data.ssid_reset === "true" || /^(PUT|POST|PATCH|DELETE)_/.test(op) || /USER_PROFILE|ACCOUNT|SUBSCRIBER_/.test(op)) return "operator";
  if (op === "DEV_TIMEZONE_CHANGED" || op === "MEASURES_DIAGNOSTICS_UPDATED" || op === "UBUS_LOG_UPLOAD") return "diagnostics";
  if (op === "NEW_NODE" || op === "NETWORK_EXTENDER_ADDED" || op === "DEV_CLAIMED" || op === "NEW_DEV_CONNECTED" || op.startsWith("MESH_")) return "mesh";
  if (op === "UBUS_NOISE_ALARM" || op.includes("CHANNEL") || op.includes("RADIO")) return "radio";
  if (op === "DEVICE_REBOOT" || op.startsWith("DEV_") || op.startsWith("NODE_")) return "status";
  if (op.includes("MEMBER") || op.startsWith("DEVICE_") || op.includes("STATION")) return "clients";
  return "diagnostics";
}

const words = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** Standard rows → TDS rows (copies), newest first as given. */
export function toTdsItems(items: EventItem[], names: EventNames): TdsItem[] {
  return items.map((it) => {
    const t: TdsItem = { ...it, fields: [...it.fields], priority: itemPriority(it), group: tdsGroup(it.events[0]) };
    if (it.kind === "outage") markFactoryReset(t);
    else if (it.kind === "single") reword(t, names);
    t.fields.push(["Severity", `P${t.priority}`]);
    return t;
  });
}

function markFactoryReset(t: TdsItem) {
  const reset = t.events.find((e) => e.operation === "DEV_REBOOT" && /factory/i.test(e.data.reason ?? ""));
  if (!reset) return;
  const fix = (s: string) => s.replace("Rebooted", "Factory reset").replace("rebooted", "factory reset");
  t.title = fix(t.title);
  t.subject = fix(t.subject);
}

function reword(t: TdsItem, names: EventNames) {
  const e = t.events[0], d = e.data;
  const name = names.short(e.device, d.name);
  const set = (subject: string, title: string, detail: string | null = null) => { t.subject = subject; t.title = title; t.detail = detail; };
  const by = d.ORIGIN === "AGENT" || e.originType === "AGENT" ? "requested by an operator" : null;
  if (d.ssid_reset === "true") return set("Main WiFi password set", "Main WiFi password set", "From the onboarding app or an operator · the password is never shown");
  switch (e.operation) {
    case "DEV_FIRMWARE_UPGRADED": {
      if (isFailure(e)) return set("Firmware upgrade failed", `Firmware upgrade failed on ${name}`, d.ERROR_MESSAGE ?? d.STATUS ?? null);
      if (eventPriority(e) === 2) return set("Firmware upgrade started", `Firmware upgrade started on ${name}`, by);
      const change = d.old_firmware || d.new_firmware ? `${d.old_firmware ?? "?"} → ${d.new_firmware ?? "?"}` : null;
      if (change) t.fields.push(["Firmware", change]);
      return set("Firmware upgraded", `Firmware upgraded on ${name}`, change);
    }
    case "DEV_CONFIG_PUSH": {
      const cfg = d.CONFIG_NAME ? `"${d.CONFIG_NAME}"` : "Configuration";
      if (isFailure(e)) return set("Configuration failed to apply", `${cfg} failed to apply on ${name}`, d.ERROR_MESSAGE ?? null);
      if (/initiat/i.test(d.STATUS ?? "")) return set("Configuration sent", `${cfg} sent to ${name}`, by);
      return set("Configuration applied", `${cfg} applied on ${name}`, null);
    }
    case "NEW_NODE":
    case "NETWORK_EXTENDER_ADDED":
    case "DEV_CLAIMED": {
      const model = d.manufacturer_model ?? d.model ?? null;
      return set("New network device", `New network device added: ${name}`, [model, d.firmware_version && `firmware ${d.firmware_version}`].filter(Boolean).join(" · ") || null);
    }
    case "NEW_DEV_CONNECTED": return set("New network device connected", `New network device connected: ${name}`, d.model ?? null);
    case "UBUS_NOISE_ALARM": {
      // freq is the channel's centre frequency in MHz (2462 = 2.4 GHz channel 11); noise in dBm.
      const mhz = Number(d.freq);
      const band = mhz > 5900 ? "6 GHz" : mhz > 4900 ? "5 GHz" : mhz > 2400 ? "2.4 GHz" : null;
      const where = mhz ? `${band ? `${band} · ` : ""}${mhz} MHz` : d.freq ?? null;
      const dbm = (v?: string) => (v && !Number.isNaN(Number(v)) ? `${v} dBm` : v);
      return set("Interference alarm", `Interference alarm on ${name}${where ? ` · ${where}` : ""}`,
        d.noise ? `Noise ${dbm(d.noise)}${d.noise_threshold ? ` (alarm at ${dbm(d.noise_threshold)})` : ""}` : null);
    }
    case "DEVICE_REBOOT": return set("Reboot requested", `Reboot requested for ${name}`, "From the app or console");
    case "STATION_DELETED": {
      const mac = d.station_mac ? d.station_mac.toUpperCase().replace(/:/g, "-") : null;
      return set("Device removed", `Device removed from the network: ${mac ? names.short(mac) : name}`, mac);
    }
    case "SUBSCRIBER_CUSTOM_TAG_UPDATE": return set("Custom tag updated", "Subscriber assigned to a custom tag", null);
    case "USER_PROFILE_CREATE": return set("App account created", "App account created", d.name ?? null);
    case "MESH_BACKHAUL_TYPE_CHANGED": return set("Backhaul band changed", `Backhaul to ${name}: ${mediumLabel(d.prev_medium)} → ${mediumLabel(d.new_medium)}`, null);
  }
  if (/^USER_PROFILE_/.test(e.operation)) {
    const what = words(e.operation.replace(/^USER_PROFILE_/, "").toLowerCase().replace(/_/g, " "));
    return set("App profile changed", `App profile changed: ${what.toLowerCase()}`, d.oldLocale && d.newLocale ? `${d.oldLocale} → ${d.newLocale}` : null);
  }
  if (t.title === humaniseOperation(e.operation) || t.title.startsWith(`${humaniseOperation(e.operation)} ·`)) {
    t.detail = t.detail ?? e.operation;
  }
}
