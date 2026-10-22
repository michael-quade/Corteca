"use client";

import type { McpNetwork } from "@/web/lib/mcpNetwork";
import type { Member } from "@/web/lib/corteca/types";
import { clientBand, clientName, clientSignalDbm, isWired } from "@/web/lib/topologyFlow";
import { highlightFor, memberSsid, type Selection } from "@/web/lib/topologySelection";
import { bandUpgrade, clientTraffic, disconnectReason, formatBytes, supportedBands } from "@/web/lib/clientInsights";
import { categoryLabel, deviceKindLabel, memberIdentity } from "@/web/lib/deviceNames";
import { clientStandard, standardLabel } from "@/web/lib/wifiDetails";
import { memberAiNotes } from "@/web/lib/aiAnalysis";
import { AiNotesSection } from "./AiNotesSection";
import { switchOfClient, wiredPort } from "@/web/lib/inferredSwitches";
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
  const path = highlightFor(network, { kind: "client", id: member.id });
  const hops = [...(path?.edges ?? [])].filter((e) => e.startsWith("bh:")).length;
  const sw = switchOfClient(network, member.id);
  const wp = wiredPort(network, member);
  const wiredType = ["Wired", wp?.port, wp?.viaSwitch ? "via switch" : wp?.speedMbps ? formatMbps(wp.speedMbps) : null].filter(Boolean).join(" · ");
  const caps = raw.client_capabilities;
  // Rates are kbps from the AP's view: its tx is the client's download.
  const down = formatMbps((raw.tx_statistics?.rate ?? 0) / 1000);
  const up = formatMbps((raw.rx_statistics?.rate ?? 0) / 1000);
  const identity = memberIdentity(member);
  const standard = clientStandard(member);
  const traffic = clientTraffic(member);
  const upgrade = bandUpgrade(member, network);
  const bands = supportedBands(member);
  const roaming = caps &&[caps.support_802p11k && "k", caps.support_802p11v && "v", caps.support_802p11r && "r"].filter(Boolean).join("/");

  return (
    <>
      <AiNotesSection notes={memberAiNotes(member)} />
      <DetailSection title="Connection">
        <DetailRow label="Access point">
          {ap ? <JumpButton onClick={() => onSelect({ kind: "ap", id: ap.mac })}>{apLabel(ap)}</JumpButton> : member.device_id}
        </DetailRow>
        {sw && (
          <DetailRow label="Via">
            <JumpButton onClick={() => onSelect({ kind: "switch", id: sw.id })}>Switch on {sw.port} (inferred)</JumpButton>
          </DetailRow>
        )}
        <DetailRow label="Path to gateway">{hops === 0 ? "Direct" : `${hops} backhaul hop${hops === 1 ? "" : "s"}`}</DetailRow>
        <DetailRow label="Type">{wired ? wiredType : `WiFi · ${clientBand(member)}`}</DetailRow>
        {!wired && <DetailRow label="SSID">{memberSsid(member)}</DetailRow>}
        {!wired && member.channel != null && member.channel > 0 && (
          <DetailRow label="Channel">{`${member.channel}${member.frequency ? ` · ${member.frequency} MHz` : ""}`}</DetailRow>
        )}
        {signal != null && <DetailRow label="Signal">{`${signal} dBm (${signalWord(signal)})`}</DetailRow>}
        {/* Wired speed is in Type (and, behind a switch, Corteca's rate is the switch's link, not the device's). */}
        {!wired && <DetailRow label="PHY rate ↓ / ↑">{down && up ? `${down} / ${up}` : down ?? up}</DetailRow>}
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
        {identity.autoAlias && identity.autoAlias !== member.alias && <DetailRow label="Detected name">{identity.autoAlias}</DetailRow>}
        {raw.hostname && raw.hostname !== member.alias && raw.hostname !== identity.autoAlias && <DetailRow label="Hostname">{raw.hostname}</DetailRow>}
        <DetailRow label="Detected as">{deviceKindLabel(member)}</DetailRow>
        <DetailRow label="Category">{categoryLabel(identity.category)}</DetailRow>
        <DetailRow label="MAC" mono>{member.id}</DetailRow>
        <DetailRow label="IPv4" mono>{member.ipv4}</DetailRow>
        <DetailRow label="IPv6" mono>{raw.ipv6?.[0]}</DetailRow>
        {!wired && <DetailRow label="Supported bands">{bands.join(" · ") || null}</DetailRow>}
        {!wired && <DetailRow label="Standard">{standard ? standardLabel(standard) : caps?.wifi_standard ?? member.wifi_standard}</DetailRow>}
        {!wired && <DetailRow label="Mode">{caps?.ht_mode}</DetailRow>}
        {!wired && <DetailRow label="802.11k/v/r">{roaming || null}</DetailRow>}
        <DetailRow label="First seen">{formatDate(member.first_seen)}</DetailRow>
      </DetailSection>
    </>
  );
}
