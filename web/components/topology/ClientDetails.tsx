"use client";

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import { clientBand, clientName, clientSignalDbm, isWired } from "@/web/lib/topologyFlow";
import { highlightFor, memberSsid, type Selection } from "@/web/lib/topologySelection";
import { bandUpgrade, clientTraffic, disconnectReason, formatBytes, supportedBands } from "@/web/lib/clientInsights";
import { DetailRow, DetailSection, JumpButton, apLabel, formatDate, formatDuration, formatMbps } from "./DetailParts";

// Fields the MCP members payload carries beyond the shared Member type.
interface RawMember {
  hostname?: string;
  signal?: number;
  ipv6?: string[];
  connected_time?: string;
  port_number?: number;
  rx_statistics?: { rate?: number };
  tx_statistics?: { rate?: number };
  client_capabilities?: { ht_mode?: string; wifi_standard?: string; support_802p11k?: boolean; support_802p11v?: boolean; support_802p11r?: boolean };
}

const signalWord = (dbm: number) => (dbm >= -65 ? "good" : dbm >= -75 ? "fair" : "poor");

export function ClientDetails({ network, member, onSelect }: {
  network: McpNetwork;
  member: Member;
  onSelect: (sel: Selection) => void;
}) {
  const raw = member as unknown as RawMember;
  const ap = network.aps.find((a) => a.mac === member.device_id);
  const wired = isWired(member);
  const signal = clientSignalDbm(member);
  const hops = (highlightFor(network, { kind: "client", id: member.id })?.edges.size ?? 1) - 1;
  const caps = raw.client_capabilities;
  // Rates are kbps from the AP's view: its tx is the client's download.
  const down = formatMbps((raw.tx_statistics?.rate ?? 0) / 1000);
  const up = formatMbps((raw.rx_statistics?.rate ?? 0) / 1000);
  const traffic = clientTraffic(member);
  const upgrade = bandUpgrade(member, network);
  const bands = supportedBands(member);
  const roaming = caps &&[caps.support_802p11k && "k", caps.support_802p11v && "v", caps.support_802p11r && "r"].filter(Boolean).join("/");

  return (
    <>
      <DetailSection title="Connection">
        <DetailRow label="Access point">
          {ap ? <JumpButton onClick={() => onSelect({ kind: "ap", id: ap.mac })}>{apLabel(ap)}</JumpButton> : member.device_id}
        </DetailRow>
        <DetailRow label="Path to gateway">{hops === 0 ? "Direct" : `${hops} backhaul hop${hops === 1 ? "" : "s"}`}</DetailRow>
        <DetailRow label="Type">{wired ? `Wired${raw.port_number ? ` · port ${raw.port_number}` : ""}` : `WiFi · ${clientBand(member)}`}</DetailRow>
        {!wired && <DetailRow label="SSID">{memberSsid(member)}</DetailRow>}
        {!wired && member.channel != null && member.channel > 0 && (
          <DetailRow label="Channel">{`${member.channel}${member.frequency ? ` · ${member.frequency} MHz` : ""}`}</DetailRow>
        )}
        {signal != null && <DetailRow label="Signal">{`${signal} dBm (${signalWord(signal)})`}</DetailRow>}
        <DetailRow label="PHY rate ↓ / ↑">{down && up ? `${down} / ${up}` : down ?? up}</DetailRow>
        {raw.connected_time && <DetailRow label="Connected for">{formatDuration(Number(raw.connected_time))}</DetailRow>}
        {traffic && <DetailRow label="Traffic ↓ / ↑">{`${formatBytes(traffic.down)} / ${formatBytes(traffic.up)}`}</DetailRow>}
        <DetailRow label="Last disconnect">{disconnectReason(member)}</DetailRow>
        {upgrade && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            On {clientBand(member)}, but this device and its access point both support {upgrade} on this SSID — band steering may not be moving it.
          </p>
        )}
      </DetailSection>

      <DetailSection title="Device">
        <DetailRow label="Name">{clientName(member)}</DetailRow>
        {raw.hostname && raw.hostname !== member.alias && <DetailRow label="Hostname">{raw.hostname}</DetailRow>}
        <DetailRow label="MAC" mono>{member.id}</DetailRow>
        <DetailRow label="IPv4" mono>{member.ipv4}</DetailRow>
        <DetailRow label="IPv6" mono>{raw.ipv6?.[0]}</DetailRow>
        {!wired && <DetailRow label="Supported bands">{bands.join(" · ") || null}</DetailRow>}
        {!wired && <DetailRow label="Standard">{caps?.wifi_standard ?? member.wifi_standard}</DetailRow>}
        {!wired && <DetailRow label="Mode">{caps?.ht_mode}</DetailRow>}
        {!wired && <DetailRow label="802.11k/v/r">{roaming || null}</DetailRow>}
        <DetailRow label="First seen">{formatDate(member.first_seen)}</DetailRow>
      </DetailSection>
    </>
  );
}
