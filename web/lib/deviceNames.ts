// Applies the gateway's user-given names (see /api/network/[deviceId]/device-names)
// to an MCP network: AP nicknames ("MBR") and client nicknames ("TV Living Room"),
// plus client manufacturer / model / category. Everything downstream (diagram,
// panels, tables, search) reads names through McpAccessPoint.nickname and
// Member.alias, so applying here is enough.

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import type { DeviceNameEntry } from "@/app/api/network/[deviceId]/device-names/route";

export type DeviceNames = Map<string, DeviceNameEntry>;

const key = (mac: string) => mac.toUpperCase().replace(/[:\-]/g, "");

export function toDeviceNames(entries: DeviceNameEntry[]): DeviceNames {
  return new Map(entries.map((e) => [key(e.mac), e]));
}

/** Extra identity a client carries once names are applied. */
export interface MemberIdentity {
  /** The alias the members API reported before a user nickname replaced it. */
  autoAlias?: string;
  manufacturer?: string;
  model?: string;
  category?: string;
}

export function memberIdentity(m: Member): MemberIdentity {
  return m as unknown as MemberIdentity;
}

export function applyDeviceNames(network: McpNetwork, names: DeviceNames | null): McpNetwork {
  if (!names || names.size === 0) return network;
  const aps = network.aps.map((ap) => {
    const alias = names.get(key(ap.mac))?.alias;
    return alias ? { ...ap, nickname: alias } : ap;
  });
  const members = network.members.map((m) => {
    const n = names.get(key(m.id));
    if (!n) return m;
    const extra: MemberIdentity = {
      manufacturer: n.manufacturer || undefined,
      model: n.model || undefined,
      category: n.category || undefined,
    };
    return n.alias
      ? ({ ...m, alias: n.alias, autoAlias: m.alias, ...extra } as Member)
      : ({ ...m, ...extra } as Member);
  });
  return { ...network, aps, members, topology: { ...network.topology, members } };
}

/** "Vizio · Television" style label from the gateway's device map. */
export function deviceKindLabel(m: Member): string | null {
  const { manufacturer, model } = memberIdentity(m);
  // Skip the manufacturer when the model already starts with it ("Roku" + "Roku Ultra").
  const parts = model && manufacturer && model.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? [model]
    : [manufacturer, model].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

const CATEGORY_LABEL: Record<string, string> = {
  WIFI_EXTENDER: "WiFi extender",
  STREAMING_DEVICE: "Streaming device",
  PC: "Computer",
  TV: "TV",
  SMART_PHONE: "Phone",
  PHONE: "Phone",
  TABLET: "Tablet",
  GAME_CONSOLE: "Game console",
  PRINTER: "Printer",
  SMART_SPEAKER: "Smart speaker",
  IOT: "IoT device",
};

export function categoryLabel(category: string | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABEL[category] ?? category.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Same names for the REST visualizer's topology data: mesh APs get `nickname`
 * (buildTree prefers it for diagram/map labels) and members get the nickname as
 * `alias` (the original kept as `autoAlias`).
 */
export function applyNamesToTopology<T extends { mesh: unknown; members?: unknown }>(data: T, names: DeviceNames | null): T {
  if (!names || names.size === 0) return data;
  const mesh = data.mesh as { aps?: Record<string, unknown>[] } | null;
  const aps = mesh?.aps?.map((ap) => {
    const alias = names.get(key(String(ap.macaddress ?? "")))?.alias;
    return alias ? { ...ap, nickname: alias } : ap;
  });
  const rename = (list: unknown[]) => list.map((m) => {
    const rec = m as Record<string, unknown>;
    const alias = names.get(key(String(rec.id ?? rec.mac ?? "")))?.alias;
    return alias ? { ...rec, alias, autoAlias: rec.alias } : rec;
  });
  const raw = data.members;
  const members = Array.isArray(raw)
    ? rename(raw)
    : raw && Array.isArray((raw as { content?: unknown[] }).content)
      ? { ...(raw as object), content: rename((raw as { content: unknown[] }).content) }
      : raw;
  return { ...data, mesh: mesh ? { ...mesh, aps } : mesh, members };
}

/** User nickname for a MAC, if the gateway has one. */
export function nicknameFor(names: DeviceNames | null, mac: string): string | undefined {
  return names?.get(key(mac))?.alias || undefined;
}
