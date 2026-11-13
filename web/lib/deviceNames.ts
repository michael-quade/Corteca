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

// ── Names for clients without a nickname ─────────────────────────────────────
// Corteca reports "Unknown_<mac>" when a client sends no hostname. Like the
// Corteca console, show the gateway's detected model instead ("iPad Pro 12.9"
// 2nd Gen (Wi-Fi)"), else manufacturer + category ("Google sensor"). Identical
// derived names get the end of the MAC ("Nest Protect · 5A-94").

const PLACEHOLDER = /^(unknown[_\s-]|[0-9a-f]{2}([:-]?[0-9a-f]{2}){5}$)/i;
export const isPlaceholderName = (name: string | undefined) => !name?.trim() || PLACEHOLDER.test(name.trim());

export function detectedName(e: DeviceNameEntry): string | null {
  if (e.model) return e.model;
  const cat = categoryLabel(e.category)?.toLowerCase();
  return e.manufacturer ? [e.manufacturer, cat].filter(Boolean).join(" ") : null;
}

/** Client id → name to show when it has no nickname and only a placeholder name. */
function derivedNames(clients: { id: string; current: string | undefined }[], names: DeviceNames): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of clients) {
    const e = names.get(key(c.id));
    const name = e && !e.alias && isPlaceholderName(c.current) ? detectedName(e) : null;
    if (name) out.set(c.id, name);
  }
  const count = new Map<string, number>();
  for (const n of out.values()) count.set(n, (count.get(n) ?? 0) + 1);
  for (const [id, n] of out) {
    if (count.get(n)! > 1) out.set(id, `${n} · ${id.toUpperCase().replace(/:/g, "-").slice(-5)}`);
  }
  return out;
}

export function applyDeviceNames(network: McpNetwork, names: DeviceNames | null): McpNetwork {
  if (!names || names.size === 0) return network;
  const aps = network.aps.map((ap) => {
    const alias = names.get(key(ap.mac))?.alias;
    return alias ? { ...ap, nickname: alias } : ap;
  });
  const derived = derivedNames(
    network.members.map((m) => ({ id: m.id, current: m.alias || (m as unknown as { hostname?: string }).hostname })),
    names,
  );
  const members = network.members.map((m) => {
    const n = names.get(key(m.id));
    if (!n) return m;
    const name = n.alias || derived.get(m.id);
    const extra: MemberIdentity = {
      manufacturer: n.manufacturer || undefined,
      model: n.model || undefined,
      category: n.category || undefined,
    };
    return name
      ? ({ ...m, alias: name, autoAlias: m.alias, ...extra } as Member)
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
  const rename = (list: unknown[]) => {
    const recs = list as Record<string, unknown>[];
    const idOf = (r: Record<string, unknown>) => String(r.id ?? r.mac ?? "");
    const derived = derivedNames(recs.map((r) => ({ id: idOf(r), current: String(r.alias ?? r.hostname ?? "") })), names);
    return recs.map((rec) => {
      const alias = names.get(key(idOf(rec)))?.alias || derived.get(idOf(rec));
      return alias ? { ...rec, alias, autoAlias: rec.alias } : rec;
    });
  };
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

/** A copy of `names` with one device's nickname changed (after a rename). */
export function withAlias(names: DeviceNames | null, mac: string, alias: string): DeviceNames {
  const next = new Map(names ?? []);
  const k = key(mac);
  const prev = next.get(k);
  next.set(k, prev ? { ...prev, alias } : { mac, alias, hostName: "", category: "", manufacturer: "", model: "" });
  return next;
}
