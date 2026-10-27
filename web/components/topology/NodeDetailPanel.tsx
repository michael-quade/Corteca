"use client";

import type { McpAccessPoint, McpBackhaulLink, McpNetwork } from "@/web/lib/mcpNetwork";
import { SLOW_ETHERNET_MBPS, clientName, isEthernet } from "@/web/lib/topologyFlow";
import { formatBytes, topTalkers } from "@/web/lib/clientInsights";
import type { Selection } from "@/web/lib/topologySelection";
import { ClientDetails } from "./ClientDetails";
import { ApEthernetPorts } from "./ApEthernetPorts";
import { ApRadios } from "./ApRadios";
import { AiNotesSection } from "./AiNotesSection";
import { SwitchDetails } from "./SwitchDetails";
import { WanDetails } from "./WanDetails";
import { GatewayLocation } from "./GatewayLocation";
import { switchById } from "@/web/lib/inferredSwitches";
import { memberIdentity } from "@/web/lib/deviceNames";
import { useDeviceRename, type RenameTarget } from "./DeviceRename";
import { DetailRow, DetailSection, JumpButton, apLabel, formatDate, formatMbps } from "./DetailParts";

type Select = (sel: Selection) => void;

function LinkSummary({ link, onSelect }: { link: McpBackhaulLink; onSelect: Select }) {
  const eth = isEthernet(link);
  return (
    <JumpButton onClick={() => onSelect({ kind: "link", id: link.childMac })}>
      {eth ? "Ethernet" : `WiFi${link.quality ? ` · ${link.quality}` : ""}`}
      {link.rateMbps ? ` · ${formatMbps(link.rateMbps)}` : ""}
    </JumpButton>
  );
}

function ApDetails({ network, ap, onSelect }: { network: McpNetwork; ap: McpAccessPoint; onSelect: Select }) {
  const uplink = network.backhaul.find((l) => l.childMac === ap.mac);
  const parent = uplink && network.aps.find((a) => a.mac === uplink.parentMac);
  const children = network.backhaul.filter((l) => l.parentMac === ap.mac);
  const talkers = topTalkers(network, ap.mac);

  return (
    <>
      {ap.role === "root" && <GatewayLocation network={network} gateway={ap} selectedId={ap.mac} onSelect={onSelect} />}
      <DetailSection title="Access point">
        <DetailRow label="Status">{ap.online ? "Online" : "Offline"}</DetailRow>
        <DetailRow label="Clients">{ap.clientCount}</DetailRow>
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
      {talkers.length > 0 && (
        <DetailSection title="Top clients by traffic">
          {talkers.map(({ member, total }) => (
            <DetailRow key={member.id} label={formatBytes(total)}>
              <JumpButton onClick={() => onSelect({ kind: "client", id: member.id })}>{clientName(member)}</JumpButton>
            </DetailRow>
          ))}
        </DetailSection>
      )}
      <ApEthernetPorts network={network} ap={ap} onSelect={onSelect} />
      <ApRadios ap={ap} />
      <DetailSection title="Mesh">
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
      </DetailSection>
    </>
  );
}

function LinkDetails({ network, link, onSelect }: { network: McpNetwork; link: McpBackhaulLink; onSelect: Select }) {
  const parent = network.aps.find((a) => a.mac === link.parentMac);
  const child = network.aps.find((a) => a.mac === link.childMac);
  const eth = isEthernet(link);
  const slow = eth && link.rateMbps != null && link.rateMbps < SLOW_ETHERNET_MBPS;
  // WiFi standard from the gateway (applyWifiDetails); without it the band-only view stays.
  const std = eth ? undefined : link.standard;
  const medium = eth ? "Ethernet" : [std ? `${std.generation} (${std.ieee})` : "WiFi", link.band].filter(Boolean).join(" · ");
  return (
    <DetailSection title="Backhaul link">
      <DetailRow label="From">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.parentMac })}>{parent ? apLabel(parent) : link.parentMac}</JumpButton>
      </DetailRow>
      <DetailRow label="To">
        <JumpButton onClick={() => onSelect({ kind: "ap", id: link.childMac })}>{child ? apLabel(child) : link.childMac}</JumpButton>
      </DetailRow>
      <DetailRow label="Medium">{medium}</DetailRow>
      {eth && <DetailRow label="Gateway port">{link.port}</DetailRow>}
      {std?.generation === "WiFi 7" && <DetailRow label="Multi-link (MLO)">{std.mlo ? "Yes" : "No"}</DetailRow>}
      {!eth && <DetailRow label="Backhaul quality">{link.quality ?? "Not rated"}</DetailRow>}
      {!eth && <DetailRow label="RSSI">{link.rssiDbm != null ? `${link.rssiDbm} dBm` : null}</DetailRow>}
      <DetailRow label="Data rate">{formatMbps(link.rateMbps)}</DetailRow>
      {!eth && <DetailRow label="PHY rate">{formatMbps(link.phyRateMbps)}</DetailRow>}
      <DetailRow label="Traffic ↓ / ↑">
        {link.bytesDown != null || link.bytesUp != null ? `${formatBytes(link.bytesDown ?? 0)} / ${formatBytes(link.bytesUp ?? 0)}` : null}
      </DetailRow>
      <DetailRow label="Errors tx / rx">
        {link.errorsTx != null || link.errorsRx != null ? `${link.errorsTx ?? "—"} / ${link.errorsRx ?? "—"}` : null}
      </DetailRow>
      {slow && (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Ethernet negotiated below 1 Gbps — often a damaged cable, a 100 Mbps switch, or a bad port.
        </p>
      )}
    </DetailSection>
  );
}

export function NodeDetailPanel({ network, selection, onSelect, onClose }: {
  network: McpNetwork;
  selection: Selection;
  onSelect: Select;
  onClose: () => void;
}) {
  const ap = selection.kind === "ap" ? network.aps.find((a) => a.mac === selection.id) : undefined;
  const member = selection.kind === "client" ? network.members.find((m) => m.id === selection.id) : undefined;
  const link = selection.kind === "link" ? network.backhaul.find((l) => l.childMac === selection.id) : undefined;
  const sw = selection.kind === "switch" ? switchById(network, selection.id) : undefined;
  const wanGateway = selection.kind === "wan" ? network.aps.find((a) => a.mac === selection.id && a.role === "root") : undefined;
  if (!ap && !member && !link && !sw && !wanGateway) return null;

  const title = ap ? apLabel(ap) : member ? clientName(member) : sw ? `Switch on ${sw.port}` : wanGateway ? "Internet" : "Backhaul link";
  const kicker = ap ? "Access point" : member ? "Client" : sw ? "Switch (inferred)" : wanGateway ? "WAN" : "Link";
  const rename = useDeviceRename();
  const renameTarget: RenameTarget | null = ap
    ? { mac: ap.mac, kind: "Beacon", description: `${ap.model} · ${ap.mac}` }
    : member
      ? { mac: member.id, kind: "client", description: `${memberIdentity(member).autoAlias ?? (member as { hostname?: string }).hostname ?? "Client"} · ${member.id}` }
      : null;
  const canRename = !!renameTarget && !!rename?.canRename(renameTarget.mac);

  return (
    <aside
      aria-label={`${kicker} details`}
      className="absolute bottom-3 right-3 top-14 z-10 flex w-80 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg"
    >
      <header className="flex items-start justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{kicker}</p>
          <h3 className="flex items-start gap-1.5 break-words text-sm font-semibold text-neutral-900">
            {title}
            {canRename && (
              <button
                type="button"
                onClick={() => rename!.start(renameTarget!)}
                aria-label={`Rename ${title}`}
                className="mt-px flex-shrink-0 rounded p-0.5 text-neutral-400 hover:bg-blue-50 hover:text-blue-600"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
              </button>
            )}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {ap && <ApDetails network={network} ap={ap} onSelect={onSelect} />}
        {member && <ClientDetails network={network} member={member} onSelect={onSelect} />}
        {link && <LinkDetails network={network} link={link} onSelect={onSelect} />}
        {sw && <SwitchDetails network={network} sw={sw} onSelect={onSelect} />}
        {wanGateway && <WanDetails network={network} gateway={wanGateway} onSelect={onSelect} />}
      </div>
    </aside>
  );
}
