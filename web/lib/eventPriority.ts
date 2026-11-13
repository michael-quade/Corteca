// P1–P4 severity for Corteca activity-log events (TDS Network Events RCR popout).
// Business levels from the TDS feature request 1.2.1. Operations seen in demo2's activity
// log are matched by name; the request's events that never appeared there (restore,
// backup, network slices, radio restart, …) are matched by keyword as a best guess
// until Corteca's operation names are confirmed. Anything unknown is P4.

import type { NetworkEvent } from "./networkEvents";
import type { EventItem } from "./eventItems";

export type Priority = 1 | 2 | 3 | 4;
export const PRIORITIES: Priority[] = [1, 2, 3, 4];

export const PRIORITY_META: Record<Priority, { label: string; short: string; bar: string; pill: string; hint: string }> = {
  1: { label: "P1 Critical", short: "P1", bar: "bg-red-600", pill: "bg-red-50 text-red-700 ring-red-200",
    hint: "Lost connection, off the mesh, failed firmware / config / restore" },
  2: { label: "P2 High", short: "P2", bar: "bg-orange-500", pill: "bg-orange-50 text-orange-700 ring-orange-200",
    hint: "Reboots, switch-offs, factory resets, backhaul to bad, upgrades started, WiFi password resets, interference" },
  3: { label: "P3 Medium", short: "P3", bar: "bg-yellow-400", pill: "bg-yellow-50 text-yellow-800 ring-yellow-200",
    hint: "New clients and Beacons, upgrades / config done, diagnostics, channel and band changes, backhaul good ↔ fair" },
  4: { label: "P4 Low", short: "P4", bar: "bg-slate-400", pill: "bg-slate-100 text-slate-600 ring-slate-200",
    hint: "Renames, type changes, log uploads, tags, console sessions, operator and app actions" },
};

/** A failure reported in the event's status fields. */
export const isFailure = (e: NetworkEvent) =>
  /fail|error/i.test(e.data.STATUS ?? e.data.status ?? "") || !!e.data.ERROR_MESSAGE;

/** Started rather than finished. */
const isStart = (e: NetworkEvent) => /initiat|start|progress/i.test(e.data.STATUS ?? e.data.status ?? "");

const BY_OPERATION: Record<string, Priority> = {
  DEV_CONNECTION_LOST: 1,
  NODE_OFFLINE: 1,
  NODE_ONLINE: 2,
  DEV_CONNECTION_OK: 2,
  DEV_REBOOT: 2,
  DEVICE_REBOOT: 2,
  DEV_SWITCH_OFF: 2,
  DEV_SWITCH_ON: 2,
  UBUS_NOISE_ALARM: 2,
  NEW_MEMBER_IN_NETWORK: 3,
  NEW_NODE: 3,
  NETWORK_EXTENDER_ADDED: 3,
  NEW_DEV_CONNECTED: 3,
  DEV_CLAIMED: 3,
  MEASURES_DIAGNOSTICS_UPDATED: 3,
  DEV_TIMEZONE_CHANGED: 3,
  USP_CHANNEL_CHANGE: 3,
  MESH_BACKHAUL_TYPE_CHANGED: 3,
  DEVICE_FRIENDLYNAME_CHANGE: 4,
  DEVICE_TYPE_CHANGE: 4,
  UBUS_LOG_UPLOAD: 4,
  SUBSCRIBER_CUSTOM_TAG_UPDATE: 4,
  HOME_CONSOLE_LOGS: 4,
  STATION_DELETED: 4,
  SYSTEM_LOGIN: 4,
};

export function eventPriority(e: NetworkEvent): Priority {
  const op = e.operation;
  if (op === "MESH_BACKHAUL_STATUS_CHANGED") return e.data.new_health === "bad" ? 2 : 3;
  if (op === "DEV_FIRMWARE_UPGRADED" || op === "DEV_CONFIG_PUSH") return isFailure(e) ? 1 : isStart(e) && op === "DEV_FIRMWARE_UPGRADED" ? 2 : 3;
  // An operator / app request that reset a WiFi password (flagged server-side, value never sent).
  if (e.data.ssid_reset === "true") return 2;
  const known = BY_OPERATION[op];
  if (known) return known;
  // Support actions by a care agent and end-user app changes.
  if (/^(PUT|POST|PATCH|DELETE)_/.test(op)) return 4;
  return guessPriority(e);
}

/** The request's events Corteca hasn't been seen logging: by keyword in the operation name. */
function guessPriority(e: NetworkEvent): Priority {
  const op = e.operation;
  const failed = /FAIL/.test(op) || isFailure(e);
  if (/BACKUP/.test(op)) return failed ? 2 : 3;
  if (/ACCOUNT|USER_PROFILE/.test(op)) return failed ? 2 : 4;
  if (/RESTORE|RADIO_RESTART|SLICE|NETWORK_ID|CONFIG|FIRMWARE/.test(op)) {
    if (failed) return 1;
    if (/SLICE/.test(op)) return /UNHEALTHY|DEGRADED/.test(op) ? 2 : /HEALTH/.test(op) ? 3 : 4;
    if (/NETWORK_ID/.test(op)) return 4;
    return isStart(e) || /INIT|START/.test(op) ? 2 : 3;
  }
  if (/NO_IP|IP_FAIL|ASSOC.*FAIL|CONNECT.*FAIL/.test(op) || failed) return 1;
  if (/FACTORY|ROLE|ROOT|IPV4|IP_ADDRESS|PASSWORD|PSK/.test(op)) return 2;
  if (/MODEM|SPEED|PING|NEIGHBOR|SCAN|DIAGNOS|TIMEZONE/.test(op)) return 3;
  return 4;
}

/** A row's level: the highest of its events (lost → rebooted → back online is P1). */
export function itemPriority(it: EventItem): Priority {
  let p: Priority = 4;
  for (const e of it.events) {
    const q = eventPriority(e);
    if (q < p) p = q;
    if (p === 1) break;
  }
  return p;
}
