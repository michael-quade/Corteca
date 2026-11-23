"use client";

import type { ReactNode } from "react";
import { cn } from "@/web/lib/utils";
import type { Member } from "@/web/lib/corteca/types";
import type { ConnectedAp, MemberConnection } from "@/web/lib/memberConnection";
import { clientSignal, clientSignalDbm, isWired } from "@/web/lib/clientFields";
import { memberSsid } from "@/web/lib/topologySelection";
import { formatRate } from "@/web/lib/rateFormat";
import { categoryLabel, memberIdentity } from "@/web/lib/deviceNames";
import { mobilityLabel, profileKey, typeLabel, typeSource, type MemberProfiles } from "@/web/lib/memberProfiles";
import { QUALITY_BG } from "@/web/components/topology/qualityStyles";
import { ConnectedApCell, DeviceCell, LastSeenCell } from "./NetworkMembersTableParts";

// Columns of the client table, modelled on the Corteca console's devices table (its column picker
// offers: device name, connected WiFi point, SSID, WiFi standard / band, MLO, signal, Tx / Rx rate,
// MAC, IP, IPv6, Type, Manufacturer, Model, Mobility, port, internet access, bandwidth priority).

export type ColumnKey =
  | "alias" | "type" | "manufacturer" | "model" | "wifi" | "device_id" | "signal" | "ssid"
  | "rate" | "ipv6" | "os" | "mobility" | "last_seen";

export type ConnectionOf = (m: Member) => MemberConnection;

/** Type / Manufacturer / Model as Corteca's console shows them; the gateway's device map when Corteca has none. */
export interface ClientIdentity { type: string; typeHint: string; manufacturer: string; model: string; os: string; mobility: string }

export function clientIdentity(m: Member, profiles: MemberProfiles | null): ClientIdentity {
  const p = profiles?.get(profileKey(m.id));
  const gw = memberIdentity(m);
  return {
    type: typeLabel(p?.type) || categoryLabel(gw.category) || "",
    typeHint: p?.type ? typeSource(p) : gw.category ? "From the gateway's device map" : "",
    manufacturer: p?.manufacturer || gw.manufacturer || "",
    model: p?.model || gw.model || "",
    os: p?.os ?? "",
    mobility: mobilityLabel(p?.mobility),
  };
}

export interface ColumnCtx {
  connection: ConnectionOf;
  /** With network context (MCP visualizer) the AP column shows name + model + MAC. */
  richAp: boolean;
  identity: (m: Member) => ClientIdentity;
}

export interface MemberColumn {
  key: ColumnKey;
  label: string;
  /** In the Columns picker; on unless `hidden`. Device and Last seen are always shown. */
  pickable?: boolean;
  hidden?: boolean;
  /** Live values that mean nothing for a client that isn't connected. */
  connectedOnly?: boolean;
  historyOnly?: boolean;
  /** Sort value; numbers sort numerically. */
  value: (m: Member, c: ColumnCtx) => string | number;
  /** Filter text (default: the sort value). */
  text?: (m: Member, c: ColumnCtx) => string;
  cell: (m: Member, c: ColumnCtx) => ReactNode;
}

const td = (content: ReactNode, cls = "text-neutral-700", title?: string) => (
  <td className={cn("px-4 py-3", cls)} title={title || undefined}>{content || "—"}</td>
);

const apText = (ap: ConnectedAp | null) => (ap ? [ap.name, ap.model, ap.gateway && "gateway", ap.mac].filter(Boolean).join(" ") : "");
const ipv6Of = (m: Member) => {
  const v = (m as unknown as { ipv6?: string[] | string }).ipv6;
  const list = Array.isArray(v) ? v : v ? [v] : [];
  // A global address is more useful than the link-local one.
  return list.find((a) => !/^fe80:/i.test(a)) ?? list[0] ?? "";
};
const rateKbps = (m: Member, dir: "tx" | "rx") =>
  Number((m as unknown as Record<string, { rate?: number } | undefined>)[`${dir}_statistics`]?.rate ?? 0);

export const MEMBER_COLUMNS: MemberColumn[] = [
  {
    key: "alias", label: "Device",
    value: (m) => `${m.alias ?? m.id}${m.paused ? " paused" : ""}`.toLowerCase(),
    // The cell carries the IP too (under the MAC), so the filter matches it.
    text: (m) => `${m.alias ?? ""} ${m.id} ${m.ipv4 ?? ""}${m.paused ? " paused" : ""}`.toLowerCase(),
    cell: (m) => <DeviceCell key="alias" m={m} />,
  },
  {
    key: "type", label: "Type", pickable: true,
    value: (m, c) => c.identity(m).type.toLowerCase(),
    cell: (m, c) => { const i = c.identity(m); return td(i.type, "text-neutral-700", i.typeHint); },
  },
  {
    key: "manufacturer", label: "Manufacturer", pickable: true,
    value: (m, c) => c.identity(m).manufacturer.toLowerCase(),
    cell: (m, c) => td(c.identity(m).manufacturer),
  },
  {
    key: "model", label: "Model", pickable: true,
    value: (m, c) => c.identity(m).model.toLowerCase(),
    cell: (m, c) => td(c.identity(m).model),
  },
  {
    // One combined column: WiFi standard · channel · band, or wired port / switch / speed.
    key: "wifi", label: "Connection", pickable: true,
    value: (m, c) => c.connection(m).link.toLowerCase(),
    cell: (m, c) => td(c.connection(m).link),
  },
  {
    key: "device_id", label: "Connected AP", pickable: true,
    value: (m, c) => apText(c.connection(m).ap).toLowerCase() || (m.device_id ?? "").toLowerCase(),
    cell: (m, c) => (c.richAp
      ? <ConnectedApCell key="device_id" ap={c.connection(m).ap} />
      : td(m.device_id, "font-mono text-xs text-neutral-500")),
  },
  {
    key: "signal", label: "Signal", pickable: true, connectedOnly: true,
    value: (m) => clientSignalDbm(m) ?? -999,
    text: (m) => (isWired(m) ? "wired" : `${clientSignalDbm(m) ?? ""} dbm`),
    cell: (m) => {
      const dbm = clientSignalDbm(m);
      const q = clientSignal(m);
      return td(dbm != null && q && (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn("h-2 w-2 rounded-full", QUALITY_BG[q])} aria-hidden />{dbm} dBm
        </span>
      ));
    },
  },
  {
    key: "ssid", label: "SSID", pickable: true, hidden: true, connectedOnly: true, // Corteca drops it on disconnect
    value: (m) => memberSsid(m).toLowerCase(),
    cell: (m) => td(memberSsid(m)),
  },
  {
    key: "rate", label: "Rate ↓ / ↑", pickable: true, hidden: true, connectedOnly: true,
    // From the AP's view, its tx is the client's download.
    value: (m) => rateKbps(m, "tx"),
    text: (m) => `${formatRate(rateKbps(m, "tx") / 1000)} ${formatRate(rateKbps(m, "rx") / 1000)}`.toLowerCase(),
    cell: (m) => td(
      rateKbps(m, "tx") || rateKbps(m, "rx")
        ? <span className="whitespace-nowrap">{formatRate(rateKbps(m, "tx") / 1000)} / {formatRate(rateKbps(m, "rx") / 1000)}</span>
        : "",
      "text-neutral-700", "Current PHY rate: download (AP → client) / upload",
    ),
  },
  {
    key: "ipv6", label: "IPv6", pickable: true, hidden: true, // IPv4 is in the Device cell
    value: (m) => ipv6Of(m).toLowerCase(),
    cell: (m) => td(ipv6Of(m), "font-mono text-xs text-neutral-500"),
  },
  {
    key: "os", label: "Operating system", pickable: true, hidden: true,
    value: (m, c) => c.identity(m).os.toLowerCase(),
    cell: (m, c) => td(c.identity(m).os),
  },
  {
    key: "mobility", label: "Mobility", pickable: true, hidden: true,
    value: (m, c) => c.identity(m).mobility.toLowerCase(),
    cell: (m, c) => td(c.identity(m).mobility, "text-neutral-700", "Corteca's mobility class for the device type (static devices are judged more strictly on coverage)"),
  },
  {
    key: "last_seen", label: "Last seen", historyOnly: true,
    value: (m) => m.last_seen ?? "",
    cell: (m) => <LastSeenCell key="last_seen" m={m} />,
  },
];

export const DEFAULT_VISIBLE: ColumnKey[] = MEMBER_COLUMNS.filter((c) => c.pickable && !c.hidden).map((c) => c.key);
export const PICKABLE_COLUMNS = MEMBER_COLUMNS.filter((c) => c.pickable);
