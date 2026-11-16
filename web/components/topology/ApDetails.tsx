"use client";

import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { clientName, isEthernet } from "@/web/lib/topologyFlow";
import { formatBytes, topTalkers } from "@/web/lib/clientInsights";
import type { Selection } from "@/web/lib/topologySelection";
import { ApEthernetPorts } from "./ApEthernetPorts";
import { ApRadios } from "./ApRadios";
import { BackhaulHistory } from "./BackhaulHistory";
import { ApEvents } from "@/web/components/events/ApEvents";
import { AiNotesSection } from "./AiNotesSection";
import { GatewayLocation } from "./GatewayLocation";
import { DetailRow, DetailSection, JumpButton, apLabel, formatDate, formatMbps } from "./DetailParts";

type Select = (sel: Selection) => void;

function LinkSummary({ link, onSelect }: { link: McpBackhaulLink; onSelect: Select }) {
  const eth = isEthernet(link);
  return (
    <JumpButton onClick={() => onSelect({ kind: "link", id: link.childMac })}>
      {eth ? "Ethernet" : `WiFi${link.mloBands ? " · MLO" : ""}${link.quality ? ` · ${link.quality}` : ""}`}
      {link.rateMbps ? ` · ${formatMbps(link.rateMbps)}` : ""}
    </JumpButton>
  );
}

/** The access point panel: identity, uplink / downlinks, ports, top clients, events, backhaul history, radios. */
export function ApDetails({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: Select }) {
  const uplink = network.backhaul.find((l) => l.childMac === ap.mac);
  const parent = uplink && network.aps.find((a) => a.mac === uplink.parentMac);
  const children = network.backhaul.filter((l) => l.parentMac === ap.mac);
  const talkers = topTalkers(network, ap.mac);

  return (
    <>
      {ap.role === "root" && <GatewayLocation network={network} gateway={ap} />}
      <DetailSection title="Access point" summary={[ap.online ? "Online" : "Offline", `${ap.clientCount} client${ap.clientCount === 1 ? "" : "s"}`, parent ? `uplink to ${apLabel(parent)}` : ap.role === "root" ? "gateway" : null, ap.firmware].filter(Boolean).join(" · ")}>
        <DetailRow label="Status">{ap.online ? "Online" : "Offline"}</DetailRow>
        <DetailRow label="Clients">{ap.clientCount}</DetailRow>
        {parent && uplink ? (
          <>
            <DetailRow label="Uplink to">
              <JumpButton onClick={() => onSelect({ kind: "ap", id: parent.mac })}>{apLabel(parent)}</JumpButton>
            </DetailRow>
            <DetailRow label="Backhaul"><LinkSummary link={uplink} onSelect={onSelect} /></DetailRow>
          </>
        ) : (
          <DetailRow label="Uplink">
            {ap.role === "root" ? <JumpButton onClick={() => onSelect({ kind: "wan", id: ap.mac })}>Internet (WAN)</JumpButton> : "Unknown"}
          </DetailRow>
        )}
        {children.map((l) => {
          const child = network.aps.find((a) => a.mac === l.childMac);
          return (
            <DetailRow key={l.childMac} label="Downlink to">
              <JumpButton onClick={() => onSelect({ kind: "ap", id: l.childMac })}>
                {child ? apLabel(child) : l.childMac}
              </JumpButton>
            </DetailRow>
          );
        })}
        {ap.mlo && <DetailRow label="Multi-link (MLO)">On</DetailRow>}
        <DetailRow label="MAC" mono>{ap.mac}</DetailRow>
        <DetailRow label="Serial" mono>{ap.serial}</DetailRow>
        <DetailRow label="Firmware" mono>{ap.firmware}</DetailRow>
        <DetailRow label="Hardware" mono>{ap.hardwareVersion}</DetailRow>
        <DetailRow label="LAN IP" mono>{ap.ipAddress}</DetailRow>
        <DetailRow label="Public IP" mono>{ap.wanIp}</DetailRow>
        <DetailRow label="Last boot">{formatDate(ap.lastBoot)}</DetailRow>
        <DetailRow label="Last offline">{formatDate(ap.lastOffline)}</DetailRow>
      </DetailSection>
      <AiNotesSection notes={ap.ai} />
      <ApEthernetPorts network={network} ap={ap} onSelect={onSelect} />
      {talkers.length > 0 && (
        <DetailSection title="Top clients by traffic" summary={`Most data: ${clientName(talkers[0].member)} · ${formatBytes(talkers[0].total)}`}>
          {talkers.map(({ member, total }) => (
            <DetailRow key={member.id} label={formatBytes(total)}>
              <JumpButton onClick={() => onSelect({ kind: "client", id: member.id })}>{clientName(member)}</JumpButton>
            </DetailRow>
          ))}
        </DetailSection>
      )}
      <ApEvents ap={ap} />
      <BackhaulHistory network={network} ap={ap} onSelect={onSelect} />
      <ApRadios ap={ap} />
    </>
  );
}
